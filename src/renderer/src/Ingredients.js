import React, { useState, useEffect } from 'react';

const { electronAPI } = window;

function Ingredients() {
  const [ingredients, setIngredients] = useState([]);
  const [form, setForm] = useState({ name: '', unit: 'гр', cost_per_unit: 0 });
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadIngredients();
  }, []);

  const filteredIngredients = ingredients.filter((ingredient) =>
    ingredient.name.toLowerCase().includes(filter.toLowerCase()),
  );

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
      // Check for duplicate names
      const existingIngredient = ingredients.find(
        (ing) =>
          ing.name.toLowerCase() === form.name.toLowerCase() && (!editing || ing.id !== editing),
      );

      if (existingIngredient) {
        alert('Ингредиент с таким названием уже существует');
        return;
      }

      if (editing) {
        await electronAPI.dbRun(
          'UPDATE ingredients SET name = ?, unit = ?, cost_per_unit = ? WHERE id = ?',
          [form.name, form.unit, form.cost_per_unit, editing],
        );
        setEditing(null);
      } else {
        await electronAPI.dbRun(
          'INSERT INTO ingredients (name, unit, cost_per_unit) VALUES (?, ?, ?)',
          [form.name, form.unit, form.cost_per_unit],
        );
      }
      setForm({ name: '', unit: 'гр', cost_per_unit: 0 });
      loadIngredients();
    } catch (error) {
      console.error('Error saving ingredient:', error);
      alert('Ошибка при сохранении ингредиента: ' + error.message);
    }
  };

  const handleEdit = (ingredient) => {
    setForm(ingredient);
    setEditing(ingredient.id);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Вы уверены, что хотите удалить этот ингредиент?')) {
      try {
        await electronAPI.dbRun('DELETE FROM ingredients WHERE id = ?', [id]);
        loadIngredients();
      } catch (error) {
        console.error('Error deleting ingredient:', error);
      }
    }
  };

  return (
    <div className="content-card">
      <h2>Управление ингредиентами</h2>

      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr auto auto',
            gap: '1rem',
            marginBottom: '1rem',
            alignItems: 'end',
          }}>
          <input
            type="text"
            placeholder="Название ингредиента"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="modern-input"
            required
          />
          <input
            type="text"
            placeholder="Единица измерения (например, кг, л, шт)"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            className="modern-input"
            required
          />
          <input
            type="number"
            step="0.01"
            placeholder="Стоимость за единицу"
            value={form.cost_per_unit}
            onChange={(e) => setForm({ ...form, cost_per_unit: parseFloat(e.target.value) || 0 })}
            className="modern-input"
            min="0"
          />
          <button type="submit" className="modern-button">
            {editing ? 'Обновить' : 'Добавить'} ингредиент
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm({ name: '', unit: 'гр', cost_per_unit: 0 });
              }}
              className="modern-button secondary">
              Отмена
            </button>
          )}
        </div>
      </form>

      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Фильтр по названию ингредиента"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="modern-input"
          style={{ maxWidth: '300px' }}
        />
      </div>

      <table className="modern-table">
        <thead>
          <tr>
            <th>Название</th>
            <th>Единица</th>
            <th>Стоимость за единицу</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {filteredIngredients.map((ingredient) => (
            <tr key={ingredient.id}>
              <td>{ingredient.name}</td>
              <td>{ingredient.unit}</td>
              <td>{ingredient.cost_per_unit} BYN</td>
              <td>
                <button
                  onClick={() => handleEdit(ingredient)}
                  className="modern-button secondary"
                  style={{ marginRight: '0.5rem', padding: '6px 12px', fontSize: '0.9rem' }}>
                  Редактировать
                </button>
                <button
                  onClick={() => handleDelete(ingredient.id)}
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

export default Ingredients;
