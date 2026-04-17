import React, { useState, useEffect } from 'react';

const { electronAPI } = window;

function BakingPlans({ isActive }) {
  const [plans, setPlans] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [form, setForm] = useState({ date: '', recipe_id: '', quantity: '1' });
  const [editing, setEditing] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  useEffect(() => {
    if (isActive) {
      loadPlans();
      loadRecipes();
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive) {
      setShowPlanModal(false);
      setEditing(null);
      setForm({ date: '', recipe_id: '', quantity: '1' });
    }
  }, [isActive]);

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

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const parsedQuantity = parseInt(form.quantity || '1', 10) || 1;

      if (editing) {
        const existing = await electronAPI.dbQuery(
          'SELECT * FROM baking_plans WHERE date = ? AND recipe_id = ? AND id != ?',
          [form.date, form.recipe_id, editing],
        );

        if (existing.length > 0) {
          const target = existing[0];
          await electronAPI.dbRun('UPDATE baking_plans SET quantity = ? WHERE id = ?', [
            target.quantity + parsedQuantity,
            target.id,
          ]);
          await electronAPI.dbRun('UPDATE kneading_batches SET plan_id = ? WHERE plan_id = ?', [
            target.id,
            editing,
          ]);
          await electronAPI.dbRun('DELETE FROM baking_plans WHERE id = ?', [editing]);
        } else {
          await electronAPI.dbRun(
            'UPDATE baking_plans SET date = ?, recipe_id = ?, quantity = ? WHERE id = ?',
            [form.date, form.recipe_id, parsedQuantity, editing],
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
            target.quantity + parsedQuantity,
            target.id,
          ]);
        } else {
          await electronAPI.dbRun(
            'INSERT INTO baking_plans (date, recipe_id, quantity) VALUES (?, ?, ?)',
            [form.date, form.recipe_id, parsedQuantity],
          );
        }
      }
      setForm({ date: '', recipe_id: '', quantity: '1' });
      setShowPlanModal(false);
      setEditing(null);
      loadPlans();
    } catch (error) {
      console.error('Error saving plan:', error);
      alert('Ошибка при сохранении плана: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (plan) => {
    if (isSubmitting) {
      return;
    }

    setForm({
      date: plan.date,
      recipe_id: String(plan.recipe_id),
      quantity: String(plan.quantity),
    });
    setEditing(plan.id);
    setShowPlanModal(true);
  };

  const openCreatePlanModal = () => {
    if (isSubmitting) {
      return;
    }

    setEditing(null);
    setForm({ date: '', recipe_id: '', quantity: '1' });
    setShowPlanModal(true);
  };

  const closePlanModal = () => {
    if (isSubmitting) {
      return;
    }

    setShowPlanModal(false);
    setEditing(null);
    setForm({ date: '', recipe_id: '', quantity: '1' });
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

  const filteredPlans = getFilteredPlans();

  return (
    <div className="content-card">
      <h2>Планы выпечки</h2>

      <div className="plans-header-actions">
        <button type="button" className="modern-button" onClick={openCreatePlanModal}>
          Добавить план
        </button>
      </div>

      <div className="plans-panel plans-filter-panel">
        <div className="plans-panel-title">Фильтр по датам</div>
        <div className="plans-filter-grid">
          <div>
            <label className="plans-label secondary">От даты</label>
            <input
              type="date"
              value={filterStart}
              onChange={(e) => setFilterStart(e.target.value)}
              className="modern-input"
            />
          </div>
          <div>
            <label className="plans-label secondary">До даты</label>
            <input
              type="date"
              value={filterEnd}
              onChange={(e) => setFilterEnd(e.target.value)}
              className="modern-input"
            />
          </div>
          <button onClick={handleResetFilter} className="modern-button secondary plans-reset-button">
            Сбросить фильтр
          </button>
          <div className="plans-filter-count">Найдено: {filteredPlans.length}</div>
        </div>
      </div>

      {showPlanModal && (
        <div className="plans-modal-backdrop">
          <div className="plans-modal">
            <div className="plans-modal-header">
              <h3>{editing ? 'Редактирование плана' : 'Добавление плана'}</h3>
              <button
                type="button"
                className="plans-modal-close"
                onClick={closePlanModal}
                disabled={isSubmitting}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="plans-form-grid">
                <div>
                  <label className="plans-label">Дата выпечки</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="modern-input"
                    required
                  />
                </div>
                <div>
                  <label className="plans-label">Рецепт</label>
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
                  <label className="plans-label">Количество для выпечки</label>
                  <input
                    type="number"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="modern-input"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="plans-actions">
                <button type="submit" className="modern-button" disabled={isSubmitting}>
                  {isSubmitting ? 'Сохранение...' : editing ? 'Обновить план' : 'Добавить план'}
                </button>
                <button
                  type="button"
                  className="modern-button secondary"
                  onClick={closePlanModal}
                  disabled={isSubmitting}>
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
          {filteredPlans.map((plan) => (
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
