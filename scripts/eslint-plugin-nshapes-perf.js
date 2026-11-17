'use strict';

/**
 * Local ESLint v9 plugin enforcing NShapes' battery, UI-thread worklet, and
 * lifecycle guardrails across `src/**`.
 */

const FRAME_HOOK_NAMES = new Set([
  'useGuardedFrameCallback',
  'useFrameCallback',
  'useAnimatedStyle',
  'useDerivedValue',
  'useAnimatedProps',
]);

const ALLOCATING_ARRAY_METHODS = new Set([
  'map',
  'filter',
  'reduce',
  'slice',
  'concat',
  'flatMap',
]);

const ALLOCATING_STATIC_METHODS = {
  Array: new Set(['from']),
  Object: new Set(['keys', 'values', 'entries']),
};

const NON_COMPOSITED_STYLE_KEYS = new Set([
  'backgroundColor',
  'borderColor',
  'width',
  'height',
  'top',
  'left',
  'right',
  'bottom',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
]);

const LIFECYCLE_DOC_EVENTS = new Set(['visibilitychange', 'freeze', 'resume']);
const LIFECYCLE_WIN_EVENTS = new Set(['pagehide', 'pageshow']);
const ACTIVITY_IDENT_RE =
  /^(appActive|active|isActive|shouldAnimate|shouldRun|visible|isVisible|ticking|playing|running|isLive)$/;

function normalizePath(filename) {
  return String(filename || '').replace(/\\/g, '/');
}

function endsWithRepoPath(normalized, relPath) {
  return normalized === relPath || normalized.endsWith('/' + relPath);
}

function unwrap(node) {
  let cur = node;
  while (
    cur &&
    (cur.type === 'TSAsExpression' ||
      cur.type === 'TSTypeAssertion' ||
      cur.type === 'TSNonNullExpression' ||
      cur.type === 'TSSatisfiesExpression' ||
      cur.type === 'ChainExpression' ||
      cur.type === 'ParenthesizedExpression')
  ) {
    cur = cur.expression;
  }
  return cur;
}

function getCalleeName(callee) {
  const c = unwrap(callee);
  if (!c) return null;
  if (c.type === 'Identifier') return c.name;
  if (c.type === 'MemberExpression' && !c.computed && c.property.type === 'Identifier') {
    return c.property.name;
  }
  return null;
}

function hasWorkletDirective(fnNode) {
  const fn = unwrap(fnNode);
  if (!fn || (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression')) {
    return false;
  }
  if (!fn.body || fn.body.type !== 'BlockStatement' || fn.body.body.length === 0) {
    return false;
  }
  const first = fn.body.body[0];
  return (
    first.type === 'ExpressionStatement' &&
    (first.directive === 'worklet' ||
      (first.expression && first.expression.type === 'Literal' && first.expression.value === 'worklet'))
  );
}

function isNegativeOne(node) {
  const n = unwrap(node);
  return (
    n &&
    n.type === 'UnaryExpression' &&
    n.operator === '-' &&
    n.argument &&
    n.argument.type === 'Literal' &&
    n.argument.value === 1
  );
}

function isFunctionNode(node) {
  return (
    node &&
    (node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression')
  );
}

function findEnclosingUseEffect(ancestors) {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const cur = ancestors[i];
    if (cur.type === 'CallExpression' && getCalleeName(cur.callee) === 'useEffect') {
      return cur;
    }
  }
  return null;
}

function findEnclosingComponentOrHook(ancestors) {
  // Prefer the outermost named/assigned component or hook inside module scope,
  // skipping small hook callbacks like useEffect(() => ...).
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const cur = ancestors[i];
    if (!isFunctionNode(cur)) continue;
    const parent = i > 0 ? ancestors[i - 1] : null;
    if (parent && parent.type === 'CallExpression') {
      const hook = getCalleeName(parent.callee);
      if (
        hook === 'useEffect' ||
        hook === 'useLayoutEffect' ||
        hook === 'useCallback' ||
        hook === 'useMemo' ||
        hook === 'useAnimatedStyle' ||
        hook === 'useDerivedValue' ||
        hook === 'useAnimatedProps'
      ) {
        continue;
      }
    }
    return cur;
  }
  return null;
}

function walkSubtree(root, visitorKeys, visit) {
  if (!root || typeof root !== 'object') return;
  const seen = new Set();
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    if (typeof node.type === 'string') {
      if (visit(node) === false) continue;
    }
    const keys = visitorKeys[node.type] || Object.keys(node);
    for (const key of keys) {
      if (key === 'parent') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (let i = child.length - 1; i >= 0; i--) {
          if (child[i] && typeof child[i].type === 'string') stack.push(child[i]);
        }
      } else if (child && typeof child.type === 'string') {
        stack.push(child);
      }
    }
  }
}

function getStringLiteral(node) {
  const n = unwrap(node);
  return n && n.type === 'Literal' && typeof n.value === 'string' ? n.value : null;
}

function getPropertyKeyName(prop) {
  if (!prop || prop.type !== 'Property') return null;
  if (!prop.computed && prop.key.type === 'Identifier') return prop.key.name;
  if (prop.key.type === 'Literal' && typeof prop.key.value === 'string') return prop.key.value;
  return null;
}

const requireGuardedFrameCallbackRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow unguarded react-native-reanimated useFrameCallback imports/calls and enforce explicit gating + worklet directive on useGuardedFrameCallback.',
    },
    schema: [],
    messages: {
      noRawImport:
        'Import useGuardedFrameCallback from "@/hooks/useGuardedFrameCallback" instead of raw useFrameCallback.',
      noRawCall:
        'Use useGuardedFrameCallback(cb, isActive, debugLabel) instead of raw useFrameCallback.',
      missingArgs:
        'useGuardedFrameCallback requires 3 arguments: (callback, isActive, debugLabel).',
      missingWorklet:
        'useGuardedFrameCallback callback must include a top-level "worklet"; directive so Reanimated compiles it for the UI thread.',
      noAlwaysTrue:
        'useGuardedFrameCallback isActive argument must not be a literal `true`; gate it on app/screen visibility.',
      missingLabel:
        'useGuardedFrameCallback requires a non-empty string literal debugLabel as the 3rd argument.',
    },
  },
  create(context) {
    const filename = normalizePath(context.filename);
    const isGatewayFile = endsWithRepoPath(filename, 'src/hooks/useGuardedFrameCallback.ts');

    return {
      ImportDeclaration(node) {
        if (isGatewayFile) return;
        if (node.source && node.source.value === 'react-native-reanimated') {
          for (const spec of node.specifiers) {
            if (
              spec.type === 'ImportSpecifier' &&
              spec.imported &&
              spec.imported.name === 'useFrameCallback'
            ) {
              context.report({ node: spec, messageId: 'noRawImport' });
            }
          }
        }
      },

      CallExpression(node) {
        const name = getCalleeName(node.callee);
        if (name === 'useFrameCallback' && !isGatewayFile) {
          context.report({ node: node.callee, messageId: 'noRawCall' });
          return;
        }
        if (name === 'useGuardedFrameCallback') {
          const args = node.arguments || [];
          if (args.length < 3) {
            context.report({ node, messageId: 'missingArgs' });
            return;
          }
          if (!hasWorkletDirective(args[0])) {
            context.report({ node: args[0], messageId: 'missingWorklet' });
          }
          const arg1 = unwrap(args[1]);
          if (arg1 && arg1.type === 'Literal' && arg1.value === true) {
            context.report({ node: args[1], messageId: 'noAlwaysTrue' });
          }
          const label = getStringLiteral(args[2]);
          if (!label || label.trim().length === 0) {
            context.report({ node: args[2], messageId: 'missingLabel' });
          }
        }
      },
    };
  },
};

const noFrameLoopAllocationsRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ban object/array spread, `new`, and allocating array/object methods inside Reanimated UI-thread worklet callbacks.',
    },
    schema: [],
    messages: {
      noSpread:
        'Avoid spread allocations (`...`) inside 60-120Hz Reanimated frame worklets; mutate shared values in place via .modify().',
      noNew: 'Avoid `new` heap allocations inside Reanimated frame worklets.',
      noAllocCall:
        'Avoid allocating array/object helper calls inside Reanimated frame worklets.',
    },
  },
  create(context) {
    const workletFns = new WeakSet();
    let depth = 0;

    return {
      CallExpression(node) {
        const hookName = getCalleeName(node.callee);
        if (hookName && FRAME_HOOK_NAMES.has(hookName) && node.arguments.length > 0) {
          const cb = unwrap(node.arguments[0]);
          if (cb && isFunctionNode(cb)) {
            workletFns.add(cb);
          }
        }
        if (depth > 0 && node.callee && node.callee.type === 'MemberExpression' && !node.callee.computed) {
          const prop = node.callee.property;
          const obj = unwrap(node.callee.object);
          if (prop && prop.type === 'Identifier') {
            if (ALLOCATING_ARRAY_METHODS.has(prop.name)) {
              context.report({ node, messageId: 'noAllocCall' });
            } else if (
              obj &&
              obj.type === 'Identifier' &&
              ALLOCATING_STATIC_METHODS[obj.name] &&
              ALLOCATING_STATIC_METHODS[obj.name].has(prop.name)
            ) {
              context.report({ node, messageId: 'noAllocCall' });
            }
          }
        }
      },

      ':function'(node) {
        if (workletFns.has(node) || depth > 0) {
          depth += 1;
        }
      },
      ':function:exit'(node) {
        if (depth > 0 && (workletFns.has(node) || depth > 0)) {
          depth -= 1;
        }
      },

      SpreadElement(node) {
        if (depth > 0) {
          context.report({ node, messageId: 'noSpread' });
        }
      },

      NewExpression(node) {
        if (depth > 0) {
          context.report({ node, messageId: 'noNew' });
        }
      },
    };
  },
};

const requireSafeInfiniteAnimationRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require infinite withRepeat(..., -1) animations to pair cancelAnimation cleanup with foreground/active gating and stick to composited transform/opacity styles.',
    },
    schema: [],
    messages: {
      missingCleanupAndGate:
        'Infinite `withRepeat(..., -1)` requires both `cancelAnimation(...)` cleanup in `useEffect` and active/app-lifecycle gating (`useAppActive()` or an explicit activity flag).',
      nonCompositedStyle:
        'Infinite animations must not animate non-composited layout/paint properties (`{{prop}}`); stick to GPU-composited `transform` and `opacity`.',
      noInterpolateColor:
        'Avoid `interpolateColor` inside components running infinite `withRepeat(..., -1)` animations.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const visitorKeys = sourceCode.visitorKeys || {};
    const infiniteComponents = new Set();
    const animatedStyleCalls = [];
    const interpolateColorCalls = [];
    let fileUsesAppActive = false;

    return {
      CallExpression(node) {
        const calleeName = getCalleeName(node.callee);

        if (calleeName === 'useAppActive') {
          fileUsesAppActive = true;
        }

        const ancestors = sourceCode.getAncestors(node);
        const component = findEnclosingComponentOrHook(ancestors);

        if (calleeName === 'useAnimatedStyle' && component) {
          animatedStyleCalls.push({ node, component });
        }

        if (calleeName === 'interpolateColor' && component) {
          interpolateColorCalls.push({ node, component });
        }

        if (calleeName === 'withRepeat' && node.arguments.length >= 2 && isNegativeOne(node.arguments[1])) {
          if (component) infiniteComponents.add(component);

          const effectCall = findEnclosingUseEffect(ancestors);
          let hasCancel = false;
          let hasActivityGate = false;

          const scanTarget = effectCall || component;
          if (scanTarget) {
            walkSubtree(scanTarget, visitorKeys, (sub) => {
              if (sub.type === 'CallExpression' && getCalleeName(sub.callee) === 'cancelAnimation') {
                hasCancel = true;
              }
              if (sub.type === 'Identifier' && ACTIVITY_IDENT_RE.test(sub.name)) {
                hasActivityGate = true;
              }
              if (sub.type === 'CallExpression' && getCalleeName(sub.callee) === 'useAppActive') {
                hasActivityGate = true;
              }
            });
          }

          if (component && !hasActivityGate) {
            walkSubtree(component, visitorKeys, (sub) => {
              if (sub.type === 'CallExpression' && getCalleeName(sub.callee) === 'useAppActive') {
                hasActivityGate = true;
              }
              if (sub.type === 'Identifier' && ACTIVITY_IDENT_RE.test(sub.name)) {
                hasActivityGate = true;
              }
            });
          }

          if (!hasCancel || (!hasActivityGate && !fileUsesAppActive)) {
            context.report({ node, messageId: 'missingCleanupAndGate' });
          }
        }
      },

      'Program:exit'() {
        for (const { node, component } of interpolateColorCalls) {
          if (infiniteComponents.has(component)) {
            context.report({ node, messageId: 'noInterpolateColor' });
          }
        }

        for (const { node, component } of animatedStyleCalls) {
          if (!infiniteComponents.has(component) || !node.arguments[0]) continue;
          const cb = unwrap(node.arguments[0]);
          walkSubtree(cb, visitorKeys, (sub) => {
            if (sub.type === 'Property') {
              const propName = getPropertyKeyName(sub);
              if (propName && NON_COMPOSITED_STYLE_KEYS.has(propName)) {
                context.report({
                  node: sub,
                  messageId: 'nonCompositedStyle',
                  data: { prop: propName },
                });
              }
            }
          });
        }
      },
    };
  },
};

const singleLifecycleAndAudioGatewayRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce single gateways for live AudioContext creation, app foreground/background listeners, and paired cancelAnimationFrame cleanup.',
    },
    schema: [],
    messages: {
      audioGateway:
        'Do not instantiate `AudioContext` outside `src/audio/chip.ts`; route Web Audio through `chip`.',
      lifecycleGateway:
        'Do not attach AppState/visibility/pagehide listeners outside `src/utils/appLifecycle.ts`; use `useAppActive()` or `subscribeAppActive()`.',
      rafNeedsCancel:
        'Files using `requestAnimationFrame` must also call `cancelAnimationFrame` in cleanup.',
    },
  },
  create(context) {
    const filename = normalizePath(context.filename);
    const isAudioGateway = endsWithRepoPath(filename, 'src/audio/chip.ts');
    const isLifecycleGateway = endsWithRepoPath(filename, 'src/utils/appLifecycle.ts');
    const rafCalls = [];
    let hasCancelRaf = false;

    return {
      NewExpression(node) {
        if (isAudioGateway) return;
        const callee = unwrap(node.callee);
        let ctorName = null;
        if (callee && callee.type === 'Identifier') {
          ctorName = callee.name;
        } else if (
          callee &&
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.object.type === 'Identifier' &&
          (callee.object.name === 'window' || callee.object.name === 'globalThis') &&
          callee.property.type === 'Identifier'
        ) {
          ctorName = callee.property.name;
        }
        if (ctorName === 'AudioContext' || ctorName === 'webkitAudioContext') {
          context.report({ node, messageId: 'audioGateway' });
        }
      },

      CallExpression(node) {
        const calleeName = getCalleeName(node.callee);
        if (calleeName === 'requestAnimationFrame') {
          rafCalls.push(node);
        } else if (calleeName === 'cancelAnimationFrame') {
          hasCancelRaf = true;
        }

        if (isLifecycleGateway) return;
        const c = unwrap(node.callee);
        if (!c || c.type !== 'MemberExpression' || c.computed) return;
        if (c.property.type !== 'Identifier' || c.property.name !== 'addEventListener') return;
        const obj = unwrap(c.object);
        if (!obj || obj.type !== 'Identifier') return;

        const eventName = getStringLiteral(node.arguments[0]);
        if (obj.name === 'AppState' && eventName === 'change') {
          context.report({ node, messageId: 'lifecycleGateway' });
        } else if (obj.name === 'document' && eventName && LIFECYCLE_DOC_EVENTS.has(eventName)) {
          context.report({ node, messageId: 'lifecycleGateway' });
        } else if (obj.name === 'window' && eventName && LIFECYCLE_WIN_EVENTS.has(eventName)) {
          context.report({ node, messageId: 'lifecycleGateway' });
        }
      },

      'Program:exit'() {
        if (rafCalls.length > 0 && !hasCancelRaf) {
          for (const rafNode of rafCalls) {
            context.report({ node: rafNode, messageId: 'rafNeedsCancel' });
          }
        }
      },
    };
  },
};

const BANNER_COMPONENTS = new Set(['CompanionBubble', 'WeaponExplainer', 'PowerExplainer']);

function getJsxTagName(openingElement) {
  if (!openingElement || !openingElement.name) return null;
  const n = openingElement.name;
  if (n.type === 'JSXIdentifier') return n.name;
  if (n.type === 'JSXMemberExpression' && n.property && n.property.type === 'JSXIdentifier') {
    return n.property.name;
  }
  return null;
}

function hasJsxAttribute(openingElement, attrName) {
  if (!openingElement || !Array.isArray(openingElement.attributes)) return false;
  return openingElement.attributes.some(
    a => a && a.type === 'JSXAttribute' && a.name && a.name.type === 'JSXIdentifier' && a.name.name === attrName
  );
}

function extractStylePropValue(propName, valueNode) {
  const v = unwrap(valueNode);
  if (!v) return undefined;
  if (v.type === 'Literal') {
    if (propName === 'flexDirection' || propName === 'flexWrap') {
      return typeof v.value === 'string' ? v.value : undefined;
    }
    if (typeof v.value === 'number') return v.value;
    if (typeof v.value === 'string') return v.value.length > 0 ? v.value : 0;
    return undefined;
  }
  if (v.type === 'TemplateLiteral' && (propName === 'width' || propName === 'maxWidth')) {
    return 'dynamic';
  }
  if (propName === 'width' || propName === 'maxWidth') {
    return 'dynamic';
  }
  if ((propName === 'flex' || propName === 'flexShrink') && v.type === 'Identifier') {
    return 'dynamic';
  }
  return undefined;
}

function extractObjectStyle(objNode) {
  const out = {};
  if (!objNode || objNode.type !== 'ObjectExpression') return out;
  for (const prop of objNode.properties) {
    if (!prop || prop.type !== 'Property') continue;
    const key = getPropertyKeyName(prop);
    if (
      key === 'flexDirection' ||
      key === 'flexWrap' ||
      key === 'flex' ||
      key === 'flexShrink' ||
      key === 'width' ||
      key === 'maxWidth'
    ) {
      const val = extractStylePropValue(key, prop.value);
      if (val !== undefined) out[key] = val;
    }
  }
  return out;
}

function isShrinkableValue(val) {
  if (val === undefined || val === null) return false;
  if (typeof val === 'number') return val > 0;
  if (typeof val === 'string') return val.length > 0;
  return false;
}

function resolveStyleExpression(expr, styleSheets) {
  const merged = {};
  function mergeFrom(node) {
    const e = unwrap(node);
    if (!e) return;
    if (e.type === 'ObjectExpression') {
      Object.assign(merged, extractObjectStyle(e));
    } else if (
      e.type === 'MemberExpression' &&
      !e.computed &&
      e.object.type === 'Identifier' &&
      e.property.type === 'Identifier'
    ) {
      const sheet = styleSheets.get(e.object.name);
      if (sheet && sheet.has(e.property.name)) {
        Object.assign(merged, sheet.get(e.property.name));
      }
    } else if (e.type === 'ArrayExpression') {
      for (const item of e.elements) {
        if (item) mergeFrom(item);
      }
    } else if (e.type === 'LogicalExpression') {
      // Only let conditional branches add row layout risk, never count conditional shrink as guaranteed
      const branch = resolveStyleExpression(e.right, styleSheets);
      if (branch.flexDirection) merged.flexDirection = branch.flexDirection;
      if (branch.flexWrap) merged.flexWrap = branch.flexWrap;
    } else if (e.type === 'ConditionalExpression') {
      const a = resolveStyleExpression(e.consequent, styleSheets);
      const b = resolveStyleExpression(e.alternate, styleSheets);
      if (a.flexDirection === 'row' || a.flexDirection === 'row-reverse') merged.flexDirection = a.flexDirection;
      else if (b.flexDirection === 'row' || b.flexDirection === 'row-reverse') merged.flexDirection = b.flexDirection;
      if (a.flexWrap === 'wrap' && b.flexWrap === 'wrap') merged.flexWrap = 'wrap';
      for (const k of ['flex', 'flexShrink', 'width', 'maxWidth']) {
        if (isShrinkableValue(a[k]) && isShrinkableValue(b[k])) merged[k] = a[k];
      }
    }
  }
  mergeFrom(expr);
  return merged;
}

function getOpeningElementStyle(openingElement, styleSheets) {
  if (!openingElement || !Array.isArray(openingElement.attributes)) return {};
  const combined = {};
  for (const attr of openingElement.attributes) {
    if (
      attr &&
      attr.type === 'JSXAttribute' &&
      attr.name &&
      attr.name.type === 'JSXIdentifier' &&
      attr.name.name === 'style' &&
      attr.value &&
      attr.value.type === 'JSXExpressionContainer'
    ) {
      Object.assign(combined, resolveStyleExpression(attr.value.expression, styleSheets));
    }
  }
  return combined;
}

function collectDirectJsxElements(children, out) {
  for (const ch of children || []) {
    if (!ch) continue;
    if (ch.type === 'JSXElement') {
      out.push(ch);
    } else if (ch.type === 'JSXExpressionContainer') {
      collectExpressionJsxElements(ch.expression, out);
    }
  }
}

function collectExpressionJsxElements(expr, out) {
  const e = unwrap(expr);
  if (!e) return;
  if (e.type === 'JSXElement') out.push(e);
  else if (e.type === 'LogicalExpression') collectExpressionJsxElements(e.right, out);
  else if (e.type === 'ConditionalExpression') {
    collectExpressionJsxElements(e.consequent, out);
    collectExpressionJsxElements(e.alternate, out);
  }
}

const noRowTextOverflowRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Prevent horizontal text clipping in React Native flexDirection: row containers where children default to flexShrink: 0.',
    },
    schema: [],
    messages: {
      rowClampedTextNeedsShrink:
        "<Text numberOfLines> inside a non-wrapping flexDirection: 'row' container will overflow in React Native (flexShrink defaults to 0). Add flex: 1 or flexShrink: 1.",
      rowBannerChildNeedsFlex:
        "<{{name}}> inside a flexDirection: 'row' parent will expand to max-content width and clip off-screen unless given flex: 1 / flexShrink: 1 (or placed in a column container).",
    },
  },
  create(context) {
    const styleSheets = new Map();
    const rowElements = [];

    return {
      CallExpression(node) {
        const c = unwrap(node.callee);
        if (
          !c ||
          c.type !== 'MemberExpression' ||
          c.computed ||
          c.object.type !== 'Identifier' ||
          c.object.name !== 'StyleSheet' ||
          c.property.type !== 'Identifier' ||
          c.property.name !== 'create'
        ) {
          return;
        }
        const arg = node.arguments[0];
        if (!arg || arg.type !== 'ObjectExpression') return;
        const parent = node.parent;
        if (!parent || parent.type !== 'VariableDeclarator' || parent.id.type !== 'Identifier') return;

        const sheet = new Map();
        for (const prop of arg.properties) {
          if (!prop || prop.type !== 'Property' || prop.value.type !== 'ObjectExpression') continue;
          const key = getPropertyKeyName(prop);
          if (key) sheet.set(key, extractObjectStyle(prop.value));
        }
        styleSheets.set(parent.id.name, sheet);
      },

      JSXElement(node) {
        rowElements.push(node);
      },

      'Program:exit'() {
        for (const node of rowElements) {
          const parentStyle = getOpeningElementStyle(node.openingElement, styleSheets);
          const dir = parentStyle.flexDirection;
          if ((dir !== 'row' && dir !== 'row-reverse') || parentStyle.flexWrap === 'wrap') continue;

          const directChildren = [];
          collectDirectJsxElements(node.children, directChildren);
          for (const child of directChildren) {
            const tagName = getJsxTagName(child.openingElement);
            if (!tagName) continue;
            const childStyle = getOpeningElementStyle(child.openingElement, styleSheets);

            if (tagName === 'Text' && hasJsxAttribute(child.openingElement, 'numberOfLines')) {
              const canShrink =
                isShrinkableValue(childStyle.flex) ||
                isShrinkableValue(childStyle.flexShrink) ||
                isShrinkableValue(childStyle.width) ||
                isShrinkableValue(childStyle.maxWidth);
              if (!canShrink) {
                context.report({ node: child, messageId: 'rowClampedTextNeedsShrink' });
              }
            } else if (BANNER_COMPONENTS.has(tagName)) {
              const hasFlex = isShrinkableValue(childStyle.flex) || isShrinkableValue(childStyle.flexShrink);
              if (!hasFlex) {
                context.report({
                  node: child,
                  messageId: 'rowBannerChildNeedsFlex',
                  data: { name: tagName },
                });
              }
            }
          }
        }
      },
    };
  },
};

module.exports = {
  rules: {
    'require-guarded-frame-callback': requireGuardedFrameCallbackRule,
    'no-frame-loop-allocations': noFrameLoopAllocationsRule,
    'require-safe-infinite-animation': requireSafeInfiniteAnimationRule,
    'single-lifecycle-and-audio-gateway': singleLifecycleAndAudioGatewayRule,
    'no-row-text-overflow': noRowTextOverflowRule,
  },
};
