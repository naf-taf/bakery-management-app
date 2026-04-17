import React, { startTransition, useState } from 'react';
import './App.css';
import Ingredients from './Ingredients';
import Recipes from './Recipes';
import BakingPlans from './BakingPlans';
import KneadingLists from './KneadingLists';

function App() {
  const [currentView, setCurrentView] = useState('ingredients');
  const [mountedViews, setMountedViews] = useState(['ingredients']);

  const showView = (view) => {
    startTransition(() => {
      setCurrentView(view);
      setMountedViews((previousViews) =>
        previousViews.includes(view) ? previousViews : [...previousViews, view],
      );
    });
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Система управления пекарней</h1>
        <nav>
          <button
            className={`nav-button ${currentView === 'ingredients' ? 'active' : ''}`}
            onClick={() => showView('ingredients')}>
            Ингредиенты
          </button>
          <button
            className={`nav-button ${currentView === 'recipes' ? 'active' : ''}`}
            onClick={() => showView('recipes')}>
            Рецепты
          </button>
          <button
            className={`nav-button ${currentView === 'plans' ? 'active' : ''}`}
            onClick={() => showView('plans')}>
            Планы выпечки
          </button>
          <button
            className={`nav-button ${currentView === 'kneading' ? 'active' : ''}`}
            onClick={() => showView('kneading')}>
            Списки замеса
          </button>
        </nav>
      </header>
      <main>
        {mountedViews.includes('ingredients') && (
          <section className={`view-panel ${currentView === 'ingredients' ? 'active' : ''}`}>
            <Ingredients isActive={currentView === 'ingredients'} />
          </section>
        )}
        {mountedViews.includes('recipes') && (
          <section className={`view-panel ${currentView === 'recipes' ? 'active' : ''}`}>
            <Recipes isActive={currentView === 'recipes'} />
          </section>
        )}
        {mountedViews.includes('plans') && (
          <section className={`view-panel ${currentView === 'plans' ? 'active' : ''}`}>
            <BakingPlans isActive={currentView === 'plans'} />
          </section>
        )}
        {mountedViews.includes('kneading') && (
          <section className={`view-panel ${currentView === 'kneading' ? 'active' : ''}`}>
            <KneadingLists isActive={currentView === 'kneading'} />
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
