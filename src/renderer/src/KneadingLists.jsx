import React, { useState, useEffect } from 'react';

const { electronAPI } = window;

function KneadingLists() {
  const [plans, setPlans] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [kneadingList, setKneadingList] = useState([]);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const rows = await electronAPI.dbQuery(`
        SELECT DISTINCT date FROM baking_plans ORDER BY date DESC
      `);
      setPlans(rows);
    } catch (error) {
      console.error('Error loading plans:', error);
    }
  };

  const generateKneadingList = async () => {
    if (!selectedDate) return;

    try {
      // Get all plans for the selected date with recipe ingredients
      const rows = await electronAPI.dbQuery(
        `
        SELECT bp.quantity, r.name as recipe_name, r.yield_quantity, r.yield_unit,
               ri.quantity as ingredient_quantity,
               i.name as ingredient_name, i.unit, i.cost_per_unit
        FROM baking_plans bp
        JOIN recipes r ON bp.recipe_id = r.id
        JOIN recipe_ingredients ri ON r.id = ri.recipe_id
        JOIN ingredients i ON ri.ingredient_id = i.id
        WHERE bp.date = ?
        ORDER BY i.name
      `,
        [selectedDate],
      );

      // Group by ingredient
      const grouped = {};
      rows.forEach((row) => {
        const key = row.ingredient_name;
        if (!grouped[key]) {
          grouped[key] = {
            name: row.ingredient_name,
            unit: row.unit,
            total_quantity: 0,
            cost_per_unit: row.cost_per_unit,
            recipes: [],
          };
        }
        const scale = row.yield_quantity > 0 ? row.quantity / row.yield_quantity : 0;
        const quantity = row.ingredient_quantity * scale;
        grouped[key].total_quantity += quantity;
        grouped[key].recipes.push(
          `${row.recipe_name}: ${row.quantity} ${row.yield_unit} (при выходе ${row.yield_quantity} ${row.yield_unit})`,
        );
      });

      const list = Object.values(grouped).map((item) => ({
        ...item,
        total_cost: item.total_quantity * item.cost_per_unit,
      }));

      setKneadingList(list);
    } catch (error) {
      console.error('Error generating kneading list:', error);
    }
  };

  const exportList = () => {
    const content =
      `Список замеса на ${selectedDate}\n\n` +
      kneadingList
        .map(
          (item) =>
            `${item.name}: ${item.total_quantity} ${item.unit} (Стоимость: ${item.total_cost.toFixed(2)} BYN)\n` +
            `  Используется в: ${item.recipes.join(', ')}\n`,
        )
        .join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kneading-list-${selectedDate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="content-card">
      <h2>ЛИСТ ЗАМЕСА ДЛЯ ПЕКАРЯ</h2>

      <div
        style={{
          marginBottom: '2rem',
          padding: '2rem',
          background: 'rgba(255, 255, 255, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(0, 0, 0, 0.1)',
        }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '500',
                color: '#333',
              }}>
              Выберите дату
            </label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="modern-input">
              <option value="">Выберите дату</option>
              {plans.map((plan) => (
                <option key={plan.date} value={plan.date}>
                  {plan.date}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={generateKneadingList}
            disabled={!selectedDate}
            className="modern-button"
            style={{
              opacity: selectedDate ? 1 : 0.6,
              cursor: selectedDate ? 'pointer' : 'not-allowed',
            }}>
            Сгенерировать список
          </button>
          {kneadingList.length > 0 && (
            <button onClick={exportList} className="modern-button secondary">
              Экспортировать список
            </button>
          )}
        </div>
      </div>

      {kneadingList.length > 0 && (
        <div>
          <h3 style={{ color: '#333', marginBottom: '1rem' }}>Список замеса на {selectedDate}</h3>
          <table className="modern-table">
            <thead>
              <tr>
                <th>Ингредиент</th>
                <th>Общее количество</th>
                <th>Стоимость</th>
                <th>Используется в рецептах</th>
              </tr>
            </thead>
            <tbody>
              {kneadingList.map((item, index) => (
                <tr key={index}>
                  <td style={{ fontWeight: '500' }}>{item.name}</td>
                  <td>
                    <span style={{ fontSize: '1.1rem', fontWeight: '600', color: '#667eea' }}>
                      {item.total_quantity.toFixed(2)}
                    </span>
                    <span style={{ marginLeft: '0.5rem', color: '#666' }}>{item.unit}</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: '600', color: '#28a745' }}>
                      {item.total_cost.toFixed(2)} BYN
                    </span>
                  </td>
                  <td style={{ fontSize: '0.9rem', color: '#666' }}>{item.recipes.join('; ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default KneadingLists;
