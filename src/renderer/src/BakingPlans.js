import React, { useState, useEffect } from 'react';

const { electronAPI } = window;

function BakingPlans() {
  const [plans, setPlans] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [form, setForm] = useState({ date: '', recipe_id: '', quantity: 1 });
  const [editing, setEditing] = useState(null);
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  useEffect(() => {
    loadPlans();
    loadRecipes();
  }, []);

  const loadPlans = async () => {
    try {
      const rows = await electronAPI.dbQuery(`
        SELECT bp.*, r.name as recipe_name, r.yield_quantity, r.yield_unit
        FROM baking_plans bp
        JOIN recipes r ON bp.recipe_id = r.id
        ORDER BY bp.date DESC, r.name
      `);
      setPlans(rows);
    } catch (error) {
      console.error('Error loading plans:', error);
    }
  };

  const loadRecipes = async () => {
    try {
      const rows = await electronAPI.dbQuery('SELECT * FROM recipes ORDER BY name');
      setRecipes(rows);
    } catch (error) {
      console.error('Error loading recipes:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        const existing = await electronAPI.dbQuery(
          'SELECT * FROM baking_plans WHERE date = ? AND recipe_id = ? AND id != ?',
          [form.date, form.recipe_id, editing],
        );

        if (existing.length > 0) {
          const target = existing[0];
          await electronAPI.dbRun('UPDATE baking_plans SET quantity = ? WHERE id = ?', [
            target.quantity + form.quantity,
            target.id,
          ]);
          await electronAPI.dbRun('DELETE FROM baking_plans WHERE id = ?', [editing]);
        } else {
          await electronAPI.dbRun(
            'UPDATE baking_plans SET date = ?, recipe_id = ?, quantity = ? WHERE id = ?',
            [form.date, form.recipe_id, form.quantity, editing],
          );
        }

        setEditing(null);
      } else {
        const existing = await electronAPI.dbQuery(
          'SELECT * FROM baking_plans WHERE date = ? AND recipe_id = ?',
          [form.date, form.recipe_id],
        );

        if (existing.length > 0) {
          const target = existing[0];
          await electronAPI.dbRun('UPDATE baking_plans SET quantity = ? WHERE id = ?', [
            target.quantity + form.quantity,
            target.id,
          ]);
        } else {
          await electronAPI.dbRun(
            'INSERT INTO baking_plans (date, recipe_id, quantity) VALUES (?, ?, ?)',
            [form.date, form.recipe_id, form.quantity],
          );
        }
      }
      setForm({ date: '', recipe_id: '', quantity: 1 });
      loadPlans();
    } catch (error) {
      console.error('Error saving plan:', error);
    }
  };

  const handleEdit = (plan) => {
    setForm({
      date: plan.date,
      recipe_id: plan.recipe_id,
      quantity: plan.quantity,
    });
    setEditing(plan.id);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Вы уверены, что хотите удалить этот план?')) {
      try {
        await electronAPI.dbRun('DELETE FROM baking_plans WHERE id = ?', [id]);
        loadPlans();
      } catch (error) {
        console.error('Error deleting plan:', error);
      }
    }
  };

  const getFilteredPlans = () => {
    return plans.filter((plan) => {
      const planDate = plan.date;
      const passStart = !filterStart || planDate >= filterStart;
      const passEnd = !filterEnd || planDate <= filterEnd;
      return passStart && passEnd;
    });
  };

  const handleResetFilter = () => {
    setFilterStart('');
    setFilterEnd('');
  };

  return (
    <div className="content-card">
      <h2>Планы выпечки</h2>

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
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '1rem',
            marginBottom: '1rem',
          }}>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '500',
                color: '#333',
              }}>
              Дата выпечки
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="modern-input"
              required
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '500',
                color: '#333',
              }}>
              Рецепт
            </label>
            <select
              value={form.recipe_id}
              onChange={(e) => setForm({ ...form, recipe_id: e.target.value })}
              className="modern-input"
              required>
              <option value="">Выберите рецепт</option>
              {recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '500',
                color: '#333',
              }}>
              Количество для выпечки
            </label>
            <input
              type="number"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
              className="modern-input"
              min="1"
              required
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="submit" className="modern-button">
            {editing ? 'Обновить план' : 'Добавить план'}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm({ date: '', recipe_id: '', quantity: 1 });
              }}
              className="modern-button secondary">
              Отмена
            </button>
          )}
        </div>
      </form>

      <div
        style={{
          marginBottom: '2rem',
          padding: '1.5rem',
          background: 'rgba(255, 255, 255, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(0, 0, 0, 0.1)',
        }}>
        <div
          style={{ marginBottom: '1rem', fontSize: '0.95rem', fontWeight: '500', color: '#333' }}>
          Фильтр по датам
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr auto auto',
            gap: '1rem',
            alignItems: 'end',
          }}>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.9rem',
                color: '#555',
              }}>
              От даты
            </label>
            <input
              type="date"
              value={filterStart}
              onChange={(e) => setFilterStart(e.target.value)}
              className="modern-input"
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.9rem',
                color: '#555',
              }}>
              До даты
            </label>
            <input
              type="date"
              value={filterEnd}
              onChange={(e) => setFilterEnd(e.target.value)}
              className="modern-input"
            />
          </div>
          <button
            onClick={handleResetFilter}
            className="modern-button secondary"
            style={{ padding: '10px 16px', fontSize: '0.9rem' }}>
            Сбросить фильтр
          </button>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>
            Найдено: {getFilteredPlans().length}
          </div>
        </div>
      </div>

      <table className="modern-table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Рецепт</th>
            <th>Количество</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {getFilteredPlans().map((plan) => (
            <tr key={plan.id}>
              <td>{plan.date}</td>
              <td>{plan.recipe_name}</td>
              <td>
                {plan.quantity} {plan.yield_unit}
                {plan.yield_quantity !== plan.quantity && (
                  <span style={{ display: 'block', color: '#666', fontSize: '0.9rem' }}>
                    (рецепт рассчитан на {plan.yield_quantity} {plan.yield_unit})
                  </span>
                )}
              </td>
              <td>
                <button
                  onClick={() => handleEdit(plan)}
                  className="modern-button secondary"
                  style={{ marginRight: '0.5rem', padding: '6px 12px', fontSize: '0.9rem' }}>
                  Изменить
                </button>
                <button
                  onClick={() => handleDelete(plan.id)}
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

export default BakingPlans;
