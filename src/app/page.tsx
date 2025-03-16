"use client";

import React from 'react';
import Game from './components/Game';
import { SocketProvider } from './context/SocketContext';

export default function Home() {
  return (
    <main className="min-h-screen p-4">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-bold">NShapes</h1>
        <p className="text-gray-600">A roguelike card matching game</p>
      </header>
      
      <SocketProvider>
        <Game />
      </SocketProvider>
    </main>
  );
}
