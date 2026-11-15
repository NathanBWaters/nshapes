module.exports = function (api) {
  const presetHandlesCompiler = api.caller((caller) =>
    Boolean(caller?.supportsReactCompiler)
  );
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          jsxImportSource: "nativewind",
          "react-compiler": { panicThreshold: "none" },
        },
      ],
      "nativewind/babel",
    ],
    plugins: [
      ...(!presetHandlesCompiler
        ? [
            [
              "babel-plugin-react-compiler",
              {
                target: "19",
                panicThreshold: "none",
                sources: (filename) =>
                  Boolean(filename && !filename.includes("node_modules")),
              },
            ],
          ]
        : []),
      "react-native-reanimated/plugin",
    ],
  };
};
