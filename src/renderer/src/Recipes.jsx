import React, { useState, useEffect } from 'react';

const { electronAPI } = window;

function Recipes() {
  const [recipes, setRecipes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    yield_quantity: 1,
    yield_unit: 'шт',
  });
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadRecipes();
    loadIngredients();
  }, []);

  const loadRecipes = async () => {
    try {
      const rows = await electronAPI.dbQuery('SELECT * FROM recipes ORDER BY name');
      setRecipes(rows);
    } catch (error) {
      console.error('Error loading recipes:', error);
    }
  };

  const loadIngredients = async () => {
    try {
      const rows = await electronAPI.dbQuery('SELECT * FROM ingredients ORDER BY name');
      setIngredients(rows);
    } catch (error) {
      console.error('Error loading ingredients:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Validate recipe ingredients
      const validIngredients = recipeIngredients.filter(
        (ri) => ri.ingredient_id && ri.quantity > 0,
      );

      if (validIngredients.length === 0) {
        alert('Добавьте хотя бы один ингредиент с количеством больше 0');
        return;
      }

      let recipeId;
      if (editing) {
        await electronAPI.dbRun(
          'UPDATE recipes SET name = ?, description = ?, yield_quantity = ?, yield_unit = ? WHERE id = ?',
          [form.name, form.description, form.yield_quantity, form.yield_unit, editing],
        );
        recipeId = editing;
        // Delete existing ingredients
        await electronAPI.dbRun('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [recipeId]);
      } else {
        const result = await electronAPI.dbRun(
          'INSERT INTO recipes (name, description, yield_quantity, yield_unit) VALUES (?, ?, ?, ?)',
          [form.name, form.description, form.yield_quantity, form.yield_unit],
        );
        recipeId = result.lastID;
      }

      // Insert valid recipe ingredients
      for (const ri of validIngredients) {
        await electronAPI.dbRun(
          'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity) VALUES (?, ?, ?)',
          [recipeId, ri.ingredient_id, ri.quantity],
        );
      }

      // Reset form
      setForm({ name: '', description: '', yield_quantity: 1, yield_unit: 'шт' });
      setRecipeIngredients([]);
      setEditing(null);
      setShowForm(false);
      loadRecipes();
    } catch (error) {
      console.error('Error saving recipe:', error);
      alert('Ошибка при сохранении рецепта: ' + error.message);
    }
  };

  const handleEdit = async (recipe) => {
    setForm({
      name: recipe.name,
      description: recipe.description || '',
      yield_quantity: recipe.yield_quantity,
      yield_unit: recipe.yield_unit,
    });
    setEditing(recipe.id);
    setShowForm(true);

    // Load recipe ingredients
    try {
      const rows = await electronAPI.dbQuery(
        'SELECT ri.*, i.name as ingredient_name, i.unit FROM recipe_ingredients ri JOIN ingredients i ON ri.ingredient_id = i.id WHERE ri.recipe_id = ?',
        [recipe.id],
      );
      setRecipeIngredients(
        rows.map((row) => ({
          ingredient_id: row.ingredient_id,
          quantity: row.quantity,
          ingredient_name: row.ingredient_name,
          unit: row.unit,
        })),
      );
    } catch (error) {
      console.error('Error loading recipe ingredients:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Вы уверены, что хотите удалить этот рецепт?')) {
      try {
        await electronAPI.dbRun('DELETE FROM recipes WHERE id = ?', [id]);
        loadRecipes();
      } catch (error) {
        console.error('Error deleting recipe:', error);
      }
    }
  };

  const addIngredient = () => {
    setRecipeIngredients([
      ...recipeIngredients,
      { ingredient_id: '', quantity: 0, ingredient_name: '', unit: '' },
    ]);
  };

  const updateIngredient = (index, field, value) => {
    const updated = [...recipeIngredients];
    if (field === 'ingredient_id') {
      // Check for duplicates
      const numValue = parseInt(value) || 0;
      if (
        numValue &&
        recipeIngredients.some((ri, i) => i !== index && parseInt(ri.ingredient_id) === numValue)
      ) {
        alert('Этот ингредиент уже добавлен в рецепт');
        return;
      }
      const ing = ingredients.find((i) => i.id === numValue);
      if (ing) {
        updated[index].ingredient_name = ing.name;
        updated[index].unit = ing.unit;
      }
    }
    updated[index][field] = value;
    setRecipeIngredients(updated);
  };

  const removeIngredient = (index) => {
    setRecipeIngredients(recipeIngredients.filter((_, i) => i !== index));
  };

  return (
    <div className="content-card">
      <h2>Управление рецептами</h2>

      <button
        onClick={() => setShowForm(!showForm)}
        className="modern-button"
        style={{ marginBottom: '2rem' }}>
        {showForm ? 'Скрыть форму' : 'Добавить новый рецепт'}
      </button>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            marginBottom: '2rem',
            padding: '2rem',
            background: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '12px',
            border: '1px solid rgba(0, 0, 0, 0.1)',
          }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              marginBottom: '1rem',
            }}>
            <input
              type="text"
              placeholder="Название рецепта"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="modern-input"
              required
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="number"
                placeholder="Количество выхода"
                value={form.yield_quantity}
                onChange={(e) =>
                  setForm({ ...form, yield_quantity: parseInt(e.target.value) || 1 })
                }
                className="modern-input"
                min="1"
                style={{ flex: '1' }}
              />
              <input
                type="text"
                placeholder="Единица выхода"
                value={form.yield_unit}
                onChange={(e) => setForm({ ...form, yield_unit: e.target.value })}
                className="modern-input"
                style={{ flex: '1' }}
              />
            </div>
          </div>

          <textarea
            placeholder="Описание рецепта"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="modern-input"
            style={{ marginBottom: '1rem', minHeight: '80px', resize: 'vertical' }}
          />

          <h3 style={{ color: '#333', marginBottom: '1rem' }}>Ингредиенты</h3>
          {recipeIngredients.map((ri, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                marginBottom: '1rem',
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.6)',
                borderRadius: '8px',
              }}>
              <select
                value={ri.ingredient_id}
                onChange={(e) => updateIngredient(index, 'ingredient_id', e.target.value)}
                className="modern-input"
                style={{ flex: '2' }}
                required>
                <option value="">Выберите ингредиент</option>
                {ingredients
                  .filter(
                    (ing) =>
                      !recipeIngredients.some(
                        (otherRi, otherIndex) =>
                          otherIndex !== index && parseInt(otherRi.ingredient_id) === ing.id,
                      ),
                  )
                  .map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit})
                    </option>
                  ))}
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="Количество"
                value={ri.quantity}
                onChange={(e) =>
                  updateIngredient(index, 'quantity', parseFloat(e.target.value) || 0)
                }
                className="modern-input"
                style={{ flex: '1' }}
                required
              />
              <span style={{ flex: '0.5', color: '#666' }}>{ri.unit}</span>
              <button
                type="button"
                onClick={() => removeIngredient(index)}
                className="modern-button"
                style={{
                  background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)',
                  padding: '8px 12px',
                  fontSize: '0.9rem',
                }}>
                Удалить
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addIngredient}
            className="modern-button secondary"
            style={{ marginBottom: '1rem' }}>
            + Добавить ингредиент
          </button>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="submit" className="modern-button">
              {editing ? 'Обновить рецепт' : 'Добавить рецепт'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setForm({ name: '', description: '', yield_quantity: 1, yield_unit: 'шт' });
                  setRecipeIngredients([]);
                  setShowForm(false);
                }}
                className="modern-button secondary">
                Отмена
              </button>
            )}
          </div>
        </form>
      )}

      <table className="modern-table">
        <thead>
          <tr>
            <th>Название</th>
            <th>Описание</th>
            <th>Выход</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {recipes.map((recipe) => (
            <tr key={recipe.id}>
              <td>{recipe.name}</td>
              <td>{recipe.description}</td>
              <td>
                {recipe.yield_quantity} {recipe.yield_unit}
              </td>
              <td>
                <button
                  onClick={() => handleEdit(recipe)}
                  className="modern-button secondary"
                  style={{ marginRight: '0.5rem', padding: '6px 12px', fontSize: '0.9rem' }}>
                  Изменить
                </button>
                <button
                  onClick={() => handleDelete(recipe.id)}
                  className="modern-button"
                  style={{
                    background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)',
                    padding: '6px 12px',
                    fontSize: '0.9rem',
                  }}>
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Recipes;
