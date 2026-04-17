import React, { useState } from 'react';
import './App.css';
import Ingredients from './Ingredients';
import Recipes from './Recipes';
import BakingPlans from './BakingPlans';
import KneadingLists from './KneadingLists';

function App() {
  const [currentView, setCurrentView] = useState('ingredients');

  return (
    <div className="App">
      <header className="App-header">
        <h1>Система управления пекарней</h1>
        <nav>
          <button
            className={`nav-button ${currentView === 'ingredients' ? 'active' : ''}`}
            onClick={() => setCurrentView('ingredients')}>
            Ингредиенты
          </button>
          <button
            className={`nav-button ${currentView === 'recipes' ? 'active' : ''}`}
            onClick={() => setCurrentView('recipes')}>
            Рецепты
          </button>
          <button
            className={`nav-button ${currentView === 'plans' ? 'active' : ''}`}
            onClick={() => setCurrentView('plans')}>
            Планы выпечки
          </button>
          <button
            className={`nav-button ${currentView === 'kneading' ? 'active' : ''}`}
            onClick={() => setCurrentView('kneading')}>
            Списки замеса
          </button>
        </nav>
      </header>
      <main>
        {currentView === 'ingredients' && <Ingredients />}
        {currentView === 'recipes' && <Recipes />}
        {currentView === 'plans' && <BakingPlans />}
        {currentView === 'kneading' && <KneadingLists />}
      </main>
    </div>
  );
}

export default App;
