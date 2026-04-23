let pdfMakePromise;

async function getPdfMake() {
    if (!pdfMakePromise) {
        pdfMakePromise = Promise.all([
            import('pdfmake/build/pdfmake'),
            import('pdfmake/build/vfs_fonts'),
        ]).then(([pdfMakeModule, pdfFontsModule]) => {
            const pdfMake = pdfMakeModule.default || pdfMakeModule;
            const pdfFonts = pdfFontsModule.default || pdfFontsModule;

            if (typeof pdfMake.addVirtualFileSystem === 'function' && pdfFonts) {
                pdfMake.addVirtualFileSystem(pdfFonts);
            }

            return pdfMake;
        });
    }

    return pdfMakePromise;
}

function formatNumber(value, maximumFractionDigits = 2) {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits,
    }).format(Number(value) || 0);
}

function buildMetaLine(label, value) {
    return {
        columns: [
            { text: `${label}:`, style: 'metaLabel', width: 140 },
            { text: String(value ?? '-'), style: 'metaValue', width: '*' },
        ],
        columnGap: 8,
        margin: [0, 0, 0, 4],
    };
}

export async function downloadPdf(docDefinition, filename) {
    const pdfMake = await getPdfMake();
    await pdfMake.createPdf(docDefinition).download(filename);
}

export function createKneadingListPdfDefinition(selectedDate, kneadingList) {
    const totalCost = kneadingList.reduce((sum, item) => sum + item.total_cost, 0);

    return {
        pageSize: 'A4',
        pageOrientation: 'landscape',
        pageMargins: [28, 32, 28, 32],
        content: [
            { text: 'Лист замеса для пекаря', style: 'title' },
            {
                columns: [
                    { text: `Дата: ${selectedDate}`, style: 'subtitle' },
                    { text: `Позиций: ${kneadingList.length}`, style: 'subtitle', alignment: 'right' },
                ],
                margin: [0, 0, 0, 12],
            },
            {
                table: {
                    headerRows: 1,
                    widths: [130, 90, 90, '*'],
                    body: [
                        [
                            { text: 'Ингредиент', style: 'tableHeader' },
                            { text: 'Количество', style: 'tableHeader' },
                            { text: 'Стоимость', style: 'tableHeader' },
                            { text: 'Используется в рецептах', style: 'tableHeader' },
                        ],
                        ...kneadingList.map((item) => [
                            { text: item.name, style: 'tableCellStrong' },
                            { text: `${formatNumber(item.total_quantity, item.unit === 'кг' ? 3 : 0)} ${item.unit}`, style: 'tableCell' },
                            { text: `${formatNumber(item.total_cost)} BYN`, style: 'tableCell' },
                            {
                                ul: item.recipes.map((recipe) => ({ text: recipe, margin: [0, 0, 0, 2] })),
                                style: 'tableCell',
                            },
                        ]),
                    ],
                },
                layout: {
                    fillColor: (rowIndex) => (rowIndex === 0 ? '#e6eefc' : rowIndex % 2 === 0 ? '#f8fbff' : null),
                    hLineColor: () => '#d9e2f0',
                    vLineColor: () => '#d9e2f0',
                    paddingLeft: () => 8,
                    paddingRight: () => 8,
                    paddingTop: () => 6,
                    paddingBottom: () => 6,
                },
            },
            {
                text: `Общая стоимость ингредиентов: ${formatNumber(totalCost)} BYN`,
                style: 'summary',
            },
        ],
        styles: {
            title: {
                fontSize: 20,
                bold: true,
                color: '#20324a',
                margin: [0, 0, 0, 6],
            },
            subtitle: {
                fontSize: 10,
                color: '#4f6480',
            },
            tableHeader: {
                bold: true,
                fontSize: 10,
                color: '#20324a',
            },
            tableCell: {
                fontSize: 9,
                color: '#334155',
            },
            tableCellStrong: {
                fontSize: 9,
                bold: true,
                color: '#1f2937',
            },
            summary: {
                margin: [0, 12, 0, 0],
                alignment: 'right',
                fontSize: 11,
                bold: true,
                color: '#0f5132',
            },
        },
        defaultStyle: {
            fontSize: 10,
            lineHeight: 1.2,
        },
    };
}

export function createRecipePdfDefinition(recipe, ingredients = []) {
    const content = [
        { text: recipe.name, style: 'title' },
        {
            text: 'Карточка рецепта',
            style: 'subtitle',
            margin: [0, 0, 0, 12],
        },
        buildMetaLine('Выход', `${recipe.yield_quantity} ${recipe.yield_unit}`),
        buildMetaLine(
            'Описание',
            recipe.description && recipe.description.trim() ? recipe.description : 'Описание не указано',
        ),
        { text: 'Ингредиенты', style: 'sectionTitle', margin: [0, 10, 0, 8] },
    ];

    if (ingredients.length > 0) {
        content.push({
            table: {
                headerRows: 1,
                widths: ['*', 120],
                body: [
                    [
                        { text: 'Ингредиент', style: 'tableHeader' },
                        { text: 'Количество', style: 'tableHeader' },
                    ],
                    ...ingredients.map((ingredient) => [
                        { text: ingredient.ingredient_name, style: 'tableCell' },
                        {
                            text: `${formatNumber(ingredient.quantity, 3)} ${ingredient.unit}`,
                            style: 'tableCell',
                        },
                    ]),
                ],
            },
            layout: {
                fillColor: (rowIndex) => (rowIndex === 0 ? '#f0efe7' : rowIndex % 2 === 0 ? '#faf8f2' : null),
                hLineColor: () => '#ddd6c8',
                vLineColor: () => '#ddd6c8',
                paddingLeft: () => 8,
                paddingRight: () => 8,
                paddingTop: () => 6,
                paddingBottom: () => 6,
            },
        });
    } else {
        content.push({
            text: 'Для рецепта не добавлены ингредиенты.',
            style: 'emptyState',
        });
    }

    return {
        pageSize: 'A4',
        pageMargins: [36, 36, 36, 36],
        content,
        styles: {
            title: {
                fontSize: 22,
                bold: true,
                color: '#2d2a23',
                margin: [0, 0, 0, 4],
            },
            subtitle: {
                fontSize: 10,
                color: '#6b6357',
            },
            sectionTitle: {
                fontSize: 11,
                bold: true,
                color: '#5a4d36',
            },
            metaLabel: {
                fontSize: 10,
                bold: true,
                color: '#5a4d36',
            },
            metaValue: {
                fontSize: 10,
                color: '#2d2a23',
            },
            tableHeader: {
                fontSize: 10,
                bold: true,
                color: '#3b3326',
            },
            tableCell: {
                fontSize: 10,
                color: '#2d2a23',
            },
            emptyState: {
                italics: true,
                color: '#7c7468',
            },
        },
        defaultStyle: {
            fontSize: 10,
            lineHeight: 1.2,
        },
    };
}
