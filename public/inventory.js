// === inventory.js - LÓGICA DE INVENTARIO ===
// Extraído de data.js. Depende de: window.player, window.itemDefs, window.toolDefs

/**
 * Verifica si `amountToAdd` del `type` dado cabe en el inventario
 * (máx 10 stacks, cada uno limitado por maxStack).
 */
window.canAddItem = function (type, amountToAdd) {
    const sim = { ...window.player.inventory };
    sim[type] = (sim[type] || 0) + amountToAdd;
    let slots = 0;
    for (const [t, amt] of Object.entries(sim)) {
        if (amt <= 0) continue;
        slots += Math.ceil(amt / ((window.itemDefs[t] && window.itemDefs[t].maxStack) || 100));
    }
    return slots <= 10;
};

/**
 * Intenta agregar un ítem al inventario.
 * @returns {boolean} true si se pudo agregar
 */
window.tryAddItem = function (type, amount) {
    if (!window.canAddItem(type, amount)) return false;
    window.player.inventory[type] = (window.player.inventory[type] || 0) + amount;
    if (window.updateUI) window.updateUI();
    if (window.renderToolbar) window.renderToolbar();
    return true;
};

/**
 * Auto-equipa una herramienta recién recogida si hay slot libre en la toolbar.
 */
window.autoEquip = function (toolId) {
    if (!window.toolDefs[toolId]) return;
    if (window.player.toolbar.includes(toolId)) return;
    const freeSlot = window.player.toolbar.indexOf(null);
    if (freeSlot !== -1) {
        window.player.toolbar[freeSlot] = toolId;
        if (!window.player.availableTools.includes(toolId)) window.player.availableTools.push(toolId);
        if (window.renderToolbar) window.renderToolbar();
    }
};

/**
 * Devuelve el tipo de refund que genera un bloque al destruirse.
 * Centraliza el mapeo que antes estaba duplicado en destroyBlockLocally.
 * @returns {{type: string, amount: number}}
 */
window.getBlockRefund = function (block) {
    const map = {
        box:       { type: 'boxes',         amount: 1 },
        campfire:  { type: 'campfire_item',  amount: 1 },
        bed:       { type: 'bed_item',       amount: 1 },
        barricade: { type: 'barricade_item', amount: 1 },
        ladder:    { type: 'ladder_item',    amount: 1 },
        door:      { type: 'wood',           amount: 2 },
    };
    return map[block.type] || { type: 'wood', amount: 1 };
};
