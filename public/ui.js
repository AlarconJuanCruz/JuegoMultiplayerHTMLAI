// === ui.js - GESTIÓN DE INTERFAZ Y EVENTOS ===

const isLocalEnv = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '';
const btnOnline = window.getEl('btn-online');
if (btnOnline) btnOnline.addEventListener('click', () => { window.startGame(true); });

const currentUrlDisplay = window.getEl('current-url'); 
const urlArea = window.getEl('online-url-area'); 
const statusBadge = window.getEl('server-status-badge');

if (!isLocalEnv) {
    if (urlArea) urlArea.style.display = 'block';
    if (currentUrlDisplay) currentUrlDisplay.innerText = window.location.origin;
    if (statusBadge) {
        statusBadge.innerHTML = 'Estado: <span style="color:#f39c12;">🟠 Despertando / Verificando...</span>';
        fetch(window.location.origin).then(r => { 
            if (r.ok) statusBadge.innerHTML = 'Estado: <span style="color:#4CAF50;">🟢 En Línea y Listo</span>'; 
            else throw new Error(); 
        }).catch(e => { 
            statusBadge.innerHTML = 'Estado: <span style="color:#ff4444;">🔴 Error de Conexión</span>'; 
        });
    }
} else {
    if (urlArea) urlArea.style.display = 'none'; 
    if (statusBadge) statusBadge.style.display = 'none'; 
}

// INICIALIZAR CHAT: Límites y detección de escritura (Typing...)
window.addEventListener('DOMContentLoaded', () => {
    const chatInp = window.getEl('chat-input');
    if (chatInp) {
        chatInp.maxLength = 70; // Límite de caracteres
        chatInp.addEventListener('focus', () => { if(window.player) window.player.isTyping = true; });
        chatInp.addEventListener('blur', () => { if(window.player) window.player.isTyping = false; });
    }
});

window.isChatLogPinned = false;
window.toggleChatLog = function() {
    window.isChatLogPinned = !window.isChatLogPinned;
    let log = window.getEl('global-chat-log');
    if (log) {
        if (window.isChatLogPinned) { 
            log.classList.add('pinned'); 
            log.querySelectorAll('.hidden-msg').forEach(el => el.style.display = 'block');
            log.scrollTop = log.scrollHeight; 
        } 
        else { 
            log.classList.remove('pinned'); 
            log.querySelectorAll('.fade-out').forEach(el => {
                el.style.display = 'none';
                el.classList.add('hidden-msg');
            });
        }
    }
};

window.addGlobalMessage = function(text, color = '#fff') {
    let log = window.getEl('global-chat-log');
    if (!log) return;
    let el = document.createElement('div');
    el.className = 'log-msg';
    el.style.borderRight = `3px solid ${color}`;
    el.style.color = color;
    el.innerHTML = text;
    log.appendChild(el);
    if (log.childNodes.length > 200) { log.removeChild(log.firstChild); }
    
    setTimeout(() => { 
        el.classList.add('fade-out'); 
        setTimeout(() => {
            if (!window.isChatLogPinned && el.parentNode) {
                el.style.display = 'none';
                el.classList.add('hidden-msg');
            }
        }, 500); 
    }, 10000);
    
    if (window.isChatLogPinned) { log.scrollTop = log.scrollHeight; }
};

window.getEl('btn-single')?.addEventListener('click', () => window.startGame(false));
window.getEl('btn-host')?.addEventListener('click', () => window.startGame(true, window.location.hostname));
window.getEl('btn-join')?.addEventListener('click', () => { const ip = window.getEl('server-ip').value; if(ip) window.startGame(true, ip); else alert("Ingresa una IP válida"); });
window.getEl('btn-help')?.addEventListener('click', () => { const t = window.getEl('game-tips'); if(t) t.style.display = t.style.display === 'none' ? 'block' : 'none'; });

window.getEl('craft-search')?.addEventListener('input', (e) => { 
    const term = (e.target.value || "").toLowerCase(); 
    document.querySelectorAll('.craft-item').forEach(item => { item.style.display = (item.getAttribute('data-name') || "").includes(term) ? 'block' : 'none'; }); 
});

window.switchCraftTab = function(tabName) {
    ['herramientas', 'armas', 'muebles'].forEach(t => {
        let el = window.getEl(`tab-${t}`); let btn = window.getEl(`btn-tab-${t}`);
        if (el) el.style.display = (t === tabName) ? 'block' : 'none';
        if (btn) btn.style.background = (t === tabName) ? '#4CAF50' : '#444';
    });
};

window.loadServers = function() {
    let list = JSON.parse(localStorage.getItem('savedServers') || '[]'); let container = window.getEl('saved-servers');
    if (!container) return;
    if (list.length === 0) container.innerHTML = '<span style="color:#aaa;">No hay servidores guardados.</span>';
    else { container.innerHTML = ''; list.forEach(ip => { let btn = document.createElement('button'); btn.className = 'action-btn mini'; btn.style.background = '#2c3e50'; btn.style.textAlign = 'left'; btn.innerText = `🔌 Conectar: ${ip}`; btn.onclick = () => { window.getEl('server-ip').value = ip; window.startGame(true, ip); }; container.appendChild(btn); }); }
};
window.loadServers();

window.toggleMenu = function(mName) {
    ['inventory', 'crafting', 'box', 'campfire'].forEach(m => { let d = window.getEl(`menu-${m}`); if(!d) return; if(m === mName) { d.classList.toggle('open'); if (m==='box') window.renderBoxUI(); if (m==='campfire') window.renderCampfireUI(); } else d.classList.remove('open'); }); window.updateUI();
};

window.eatFood = function(hpG, hunG) {
    let type = hpG === 15 ? 'meat' : 'cooked_meat';
    if (window.player.inventory[type] > 0 && window.player.hunger < window.player.maxHunger) { window.player.inventory[type]--; window.player.hunger += hunG; if (window.player.hunger > window.player.maxHunger) window.player.hunger = window.player.maxHunger; window.player.hp += hpG; if(window.player.hp > window.player.maxHp) window.player.hp = window.player.maxHp; window.spawnParticles(window.player.x + window.player.width/2, window.player.y, '#4CAF50', 10); window.updateUI(); }
};

window.invItemClick = function(type) {
    if (type === 'meat') window.eatFood(15, 30); 
    else if (type === 'cooked_meat') window.eatFood(30, 60);
    else if (['boxes', 'campfire_item', 'bed_item'].includes(type) || window.toolDefs[type]) { 
        if (typeof window.autoEquip === 'function') window.autoEquip(type); window.toggleMenu('inventory'); 
    }
};

window.upgradeStat = function(stat) { if (window.player.statPoints > 0) { window.player.stats[stat]++; window.player.statPoints--; window.recalculateStats(); window.updateUI(); } };

window.transferItem = function(type, toBox, amount) {
    if(!window.currentOpenBox) return;
    if (!toBox && !window.canAddItem(type, amount)) { window.spawnDamageText(window.player.x + window.player.width/2, window.player.y - 20, "Inv. Lleno", '#fff'); return; }
    if(toBox && window.player.inventory[type] >= amount) { window.player.inventory[type] -= amount; window.currentOpenBox.inventory[type] = (window.currentOpenBox.inventory[type] || 0) + amount; } 
    else if (!toBox && window.currentOpenBox.inventory[type] >= amount) { window.currentOpenBox.inventory[type] -= amount; window.player.inventory[type] = (window.player.inventory[type] || 0) + amount; } 
    else if (toBox && window.player.inventory[type] > 0) { let r = window.player.inventory[type]; window.player.inventory[type] = 0; window.currentOpenBox.inventory[type] = (window.currentOpenBox.inventory[type] || 0) + r; } 
    else if (!toBox && window.currentOpenBox.inventory[type] > 0) { let r = window.currentOpenBox.inventory[type]; window.currentOpenBox.inventory[type] = 0; window.player.inventory[type] = (window.player.inventory[type] || 0) + r; }
    if (window.sendWorldUpdate) window.sendWorldUpdate('update_box', { x: window.currentOpenBox.x, y: window.currentOpenBox.y, inventory: window.currentOpenBox.inventory });
    window.renderBoxUI(); window.updateUI();
};

window.cfAction = function(action) {
    if(!window.currentCampfire) return;
    if (action === 'takeCooked' && window.currentCampfire.cooked > 0) { if (!window.canAddItem('cooked_meat', window.currentCampfire.cooked)) { window.spawnDamageText(window.player.x + window.player.width/2, window.player.y - 20, "Inv. Lleno", '#fff'); return; } }
    if (action === 'addWood' && window.player.inventory.wood > 0) { window.player.inventory.wood--; window.currentCampfire.wood++; }
    if (action === 'addMeat' && window.player.inventory.meat > 0) { window.player.inventory.meat--; window.currentCampfire.meat++; }
    if (action === 'takeCooked' && window.currentCampfire.cooked > 0) { window.player.inventory.cooked_meat = (window.player.inventory.cooked_meat||0) + window.currentCampfire.cooked; window.currentCampfire.cooked = 0; }
    if (action === 'toggleFire') { if (window.currentCampfire.isBurning) window.currentCampfire.isBurning = false; else if (window.currentCampfire.wood > 0) { window.currentCampfire.isBurning = true; window.currentCampfire.wood--; window.currentCampfire.burnTime = 1800; } }
    if (window.sendWorldUpdate) window.sendWorldUpdate('update_campfire', { x: window.currentCampfire.x, y: window.currentCampfire.y, wood: window.currentCampfire.wood, meat: window.currentCampfire.meat, cooked: window.currentCampfire.cooked, isBurning: window.currentCampfire.isBurning });
    window.renderCampfireUI(); window.updateUI();
};

window.takeAllFromBox = function() {
    if (!window.currentOpenBox) return;
    let taken = 0;
    for (const [type, amt] of Object.entries(window.currentOpenBox.inventory)) {
        if (amt <= 0) continue;
        let canTake = Math.min(amt, 999);
        // Intentar agregar de a poco hasta llenar
        for (let a = canTake; a >= 1; a--) {
            if (window.canAddItem(type, a)) {
                window.player.inventory[type] = (window.player.inventory[type] || 0) + a;
                window.currentOpenBox.inventory[type] -= a;
                taken++;
                break;
            }
        }
    }
    if (taken === 0) window.spawnDamageText(window.player.x + window.player.width/2, window.player.y - 20, "Inventario lleno", '#fff');
    else if (window.playSound) window.playSound('pickup');
    if (window.sendWorldUpdate) window.sendWorldUpdate('update_box', { x: window.currentOpenBox.x, y: window.currentOpenBox.y, inventory: window.currentOpenBox.inventory });
    window.renderBoxUI(); window.updateUI();
};

window.renderBoxUI = function() {
    if (!window.currentOpenBox || !window.getEl('box-player-grid')) return;

    // Actualizar header dinámico: cofre vs tumba
    const headerEl = window.getEl('box-dynamic-header');
    const isGrave = window.currentOpenBox.type === 'grave';
    if (headerEl) headerEl.innerHTML = isGrave ? '✝️ Objetos perdidos' : '📦 Cofre';

    // Mostrar/ocultar botón "Agarrar todo" (solo aplica al lado de la caja/tumba)
    const takeAllBtn = window.getEl('btn-take-all-box');
    if (takeAllBtn) takeAllBtn.style.display = 'inline-block';

    const renderGrid = (inv, domId, toBox) => {
        const grid = window.getEl(domId);
        grid.innerHTML = '';
        for (const [type, amt] of Object.entries(inv)) {
            if (amt <= 0) continue;
            const s = document.createElement('div');
            s.className = 'inv-slot';
            s.onclick = () => { window.transferItem(type, toBox, 1); if (window.playSound) window.playSound('pickup'); };
            s.oncontextmenu = (e) => { e.preventDefault(); window.transferItem(type, toBox, 10); if (window.playSound) window.playSound('pickup'); };
            const def = window.itemDefs[type] || {};
            const color = def.color || '#fff';
            const name = def.name || type;
            s.innerHTML = `<div class="inv-icon" style="background-color:${color}"></div><div class="inv-amount">${amt}</div><div class="custom-tooltip">${name}</div>`;
            grid.appendChild(s);
        }
    };
    renderGrid(window.player.inventory, 'box-player-grid', true);
    renderGrid(window.currentOpenBox.inventory, 'box-storage-grid', false);
};

window.renderCampfireUI = function() {
    if(!window.currentCampfire || !window.getEl('cf-wood-count')) return;
    window.getEl('cf-wood-count').innerText = window.currentCampfire.wood; window.getEl('cf-meat-count').innerText = window.currentCampfire.meat; window.getEl('cf-cooked-count').innerText = window.currentCampfire.cooked;
    let btn = window.getEl('btn-cf-ignite');
    if (window.currentCampfire.isBurning) { btn.innerText = "APAGAR"; btn.style.background = "#555"; } else { btn.innerText = "🔥 ENCENDER"; btn.style.background = "#e67e22"; }
};

window.autoEquip = function(id) {
    if (!window.player.toolbar) window.player.toolbar = ['hand', null, null, null, null, null];
    if (!window.player.toolbar.includes(id)) {
        let idx = window.player.toolbar.indexOf(null);
        if (idx !== -1) { 
            window.player.toolbar[idx] = id; 
            window.selectToolbarSlot(idx);
            if(window.renderToolbar) window.renderToolbar();
            if(window.updateUI) window.updateUI(); 
        }
    } else {
        let existingIdx = window.player.toolbar.indexOf(id);
        window.selectToolbarSlot(existingIdx);
        if(window.renderToolbar) window.renderToolbar();
    }
};

window.handleToolbarDrop = function(e, slotIndex) {
    e.preventDefault();
    let type = e.dataTransfer.getData('text/plain');
    if (!window.player.toolbar) window.player.toolbar = ['hand', null, null, null, null, null];
    
    if (type) {
        let oldIdx = window.player.toolbar.indexOf(type);
        if (oldIdx !== -1) window.player.toolbar[oldIdx] = null;
        window.player.toolbar[slotIndex] = type;
        window.selectToolbarSlot(slotIndex);
        if(window.renderToolbar) window.renderToolbar();
        if(window.updateUI) window.updateUI(); 
    }
};

window.selectToolbarSlot = function(index) {
    if (!window.player.toolbar) return;
    window.player.activeSlot = index;
    let item = window.player.toolbar[index];
    
    window.player.isAiming = false; 
    window.player.isCharging = false; 
    window.player.chargeLevel = 0;
    
    if (item && window.toolDefs[item]) {
        window.player.activeTool = item;
        window.player.placementMode = null;
    } else if (item && window.player.inventory[item] > 0) {
        if (['boxes', 'campfire_item', 'bed_item', 'barricade_item'].includes(item)) {
            window.player.activeTool = 'hand';
            window.player.placementMode = item;
        } else {
            window.player.activeTool = 'hand';
            window.player.placementMode = null;
        }
    } else {
        window.player.activeTool = 'hand';
        window.player.placementMode = null;
    }
};

function getInvDef(type, isTool) {
    let def = isTool ? window.toolDefs[type] : window.itemDefs[type];
    if (!def) {
        if (type === 'boxes') return { name: 'Caja', color: '#8B4513' };
        if (type === 'campfire_item') return { name: 'Fogata', color: '#e67e22' };
        if (type === 'bed_item') return { name: 'Cama', color: '#c0392b' };
        return { name: type, color: '#aaa' };
    }
    return def;
}

window.renderToolbar = function() {
    let tb = window.getEl('toolbar');
    if(!tb) return;
    tb.innerHTML = '';
    
    if(!window.player.toolbar) window.player.toolbar = ['hand', null, null, null, null, null];
    
    for(let i=0; i<6; i++) {
        let itemId = window.player.toolbar[i];
        let div = document.createElement('div');
        div.className = `tool-slot ${window.player.activeSlot === i ? 'active' : ''}`;
        
        div.ondragover = (e) => e.preventDefault();
        div.ondrop = (e) => { e.stopPropagation(); window.handleToolbarDrop(e, i); };

        let content = `<span style="position:absolute; top:2px; left:4px; font-size:10px; color:#aaa; font-weight:bold;">${i+1}</span>`;
        
        if (itemId) {
            if (itemId !== 'hand') {
                div.draggable = true;
                div.ondragstart = (e) => {
                    e.dataTransfer.setData('text/plain', itemId);
                    e.dataTransfer.setData('source', 'toolbar');
                };
            }
            
            if (window.toolDefs[itemId]) {
                let tool = window.toolDefs[itemId]; let durHTML = '';
                if (itemId !== 'hand' && window.toolMaxDurability[itemId] !== undefined) {
                    const maxDur = window.toolMaxDurability[itemId];
                    if (typeof window.player.toolHealth[itemId] !== 'number' || isNaN(window.player.toolHealth[itemId])) { window.player.toolHealth[itemId] = maxDur; }
                    let pct = Math.max(0, Math.min(100, (window.player.toolHealth[itemId] / maxDur) * 100));
                    let color = pct > 50 ? '#4CAF50' : (pct > 20 ? '#f39c12' : '#e74c3c');
                    durHTML = `<div style="position:absolute; bottom:0; left:0; width:100%; height:4px; background:#111;"><div style="height:100%; width:${pct.toFixed(1)}%; background:${color}; transition: width 0.2s;"></div></div>`;
                }
                content += `<div style="margin-top:10px; font-size:11px;">${tool.name}</div>${durHTML}`;
            } else {
                let def = getInvDef(itemId, false);
                let count = window.player.inventory[itemId] || 0;
                if (count <= 0) {
                    window.player.toolbar[i] = null;
                    if (window.player.activeSlot === i) { window.selectToolbarSlot(0); }
                } else {
                    content += `<div class="inv-icon" style="background-color: ${def.color}; width:24px; height:24px; margin: auto; border-radius:3px;"></div><div class="inv-amount" style="position:absolute; bottom:2px; right:4px;">${count}</div>`;
                }
            }
        }
        div.innerHTML = content;
        div.onclick = () => { window.selectToolbarSlot(i); window.renderToolbar(); };
        tb.appendChild(div);
    }
};

window.getReqText = function(rW, rS, rWeb, rInt) {
    let t = ""; if (window.player.stats.int < rInt) t += `<span style="color:#ff6b6b; margin-left:5px;">Req. INT ${rInt}</span> `;
    let mW = rW - window.player.inventory.wood; let mWeb = rWeb - (window.player.inventory.web||0); let mS = rS - (window.player.inventory.stone || 0);
    if (mW > 0) t += `<span style="color:#ff6b6b; margin-left:5px;">Falta ${mW} Mad.</span>`; if (mWeb > 0) t += `<span style="color:#ff6b6b; margin-left:5px;">Falta ${mWeb} Tela</span>`; if (mS > 0) t += `<span style="color:#ff6b6b; margin-left:5px;">Falta ${mS} Pie.</span>`; return t === "" ? '<span class="req-text-ok">Recursos OK</span>' : t;
};

window.updateUI = function() { 
    let menuInv = window.getEl('menu-inventory');
    if (menuInv && !menuInv.dataset.dragBind) {
        menuInv.dataset.dragBind = "true";
        menuInv.addEventListener('dragover', (e) => e.preventDefault());
        menuInv.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation(); 
            let type = e.dataTransfer.getData('text/plain');
            let source = e.dataTransfer.getData('source');
            if (source === 'toolbar' && window.player.toolbar) {
                let idx = window.player.toolbar.indexOf(type);
                if (idx !== -1) {
                    window.player.toolbar[idx] = null;
                    if (window.player.activeSlot === idx) window.selectToolbarSlot(0);
                    if(window.renderToolbar) window.renderToolbar();
                    window.updateUI();
                }
            }
        });
    }

    const grid = window.getEl('inventory-grid'); 
    if(grid) {
        grid.innerHTML = '';
        let itemsToRender = [];

        if (window.player.availableTools) {
            window.player.availableTools.forEach(tool => {
                if (tool !== 'hand' && (!window.player.toolbar || !window.player.toolbar.includes(tool))) {
                    itemsToRender.push({ type: tool, isTool: true, amount: 1 });
                }
            });
        }

        for (const [type, amt] of Object.entries(window.player.inventory)) {
            if (amt <= 0) continue;
            if (window.player.toolbar && window.player.toolbar.includes(type)) continue;

            let def = window.itemDefs[type] || {};
            let max = def.maxStack || 100;
            let remaining = amt;
            while (remaining > 0) {
                let inSlot = Math.min(remaining, max);
                itemsToRender.push({ type, isTool: false, amount: inSlot });
                remaining -= inSlot;
            }
        }

        let totalCells = 20; 
        let cellsUsed = 0;

        itemsToRender.forEach((slotData) => {
            if (cellsUsed >= totalCells) return; 

            const slot = document.createElement('div');
            let isLarge = slotData.type === 'bow'; 
            let cellsTaken = isLarge ? 2 : 1;

            if (cellsUsed + cellsTaken > totalCells) return;

            slot.className = 'inv-slot' + (isLarge ? ' span-2' : '');
            slot.draggable = true;
            slot.ondragstart = (e) => { 
                e.dataTransfer.setData('text/plain', slotData.type); 
                e.dataTransfer.setData('source', 'inventory');
            };

            let def = getInvDef(slotData.type, slotData.isTool);

            if (slotData.isTool) {
                slot.onclick = () => { window.autoEquip(slotData.type); window.toggleMenu('inventory'); };
                
                let maxDur = window.toolMaxDurability[slotData.type];
                let durHTML = '';
                if (maxDur) {
                    let currentDur = window.player.toolHealth[slotData.type] || maxDur;
                    let pct = Math.max(0, Math.min(100, (currentDur / maxDur) * 100));
                    let color = pct > 50 ? '#4CAF50' : (pct > 20 ? '#f39c12' : '#e74c3c');
                    durHTML = `<div style="position:absolute; bottom:0; left:0; width:100%; height:4px; background:#111;"><div style="height:100%; width:${pct}%; background:${color};"></div></div>`;
                }
                
                let iconStyle = `background-color: ${def.color};`;
                if (isLarge) iconStyle += ' height: 80%; width: 80%; border-radius: 8px;';
                
                slot.innerHTML = `<div class="inv-icon" style="${iconStyle}"></div><div class="custom-tooltip">${def.name}</div>${durHTML}`;
            } else {
                slot.onclick = () => window.invItemClick(slotData.type);
                slot.innerHTML = `<div class="inv-icon" style="background-color: ${def.color}"></div><div class="inv-amount">${slotData.amount}</div><div class="custom-tooltip">${def.name}</div>`;
            }
            grid.appendChild(slot);
            cellsUsed += cellsTaken;
        });

        while (cellsUsed < totalCells) {
            const slot = document.createElement('div');
            slot.className = 'inv-slot empty';
            slot.style.background = 'rgba(0,0,0,0.5)';
            slot.style.border = '1px dashed rgba(255,255,255,0.2)';
            grid.appendChild(slot);
            cellsUsed++;
        }
    }
    
    let elTxt = (id, t) => { let e = window.getEl(id); if(e) e.innerText = t; }; let elW = (id, w) => { let e = window.getEl(id); if(e) e.style.width = w; };
    elTxt('stat-points', window.player.statPoints); elTxt('stat-str', window.player.stats.str); elTxt('stat-agi', window.player.stats.agi); elTxt('stat-vit', window.player.stats.vit); elTxt('stat-sta', window.player.stats.sta); elTxt('stat-int', window.player.stats.int);
    
    document.querySelectorAll('.stat-btn').forEach(btn => { btn.disabled = window.player.statPoints <= 0; });
    const sNotif = window.getEl('stat-notif'); if(sNotif) sNotif.style.display = window.player.statPoints > 0 ? 'flex' : 'none';

    elW('hp-fill', `${(window.player.hp / window.player.maxHp) * 100}%`); elTxt('hp-text', `${Math.floor(window.player.hp)} / ${window.player.maxHp}`);
    elW('hunger-fill', `${(window.player.hunger / window.player.maxHunger) * 100}%`); elTxt('hunger-text', `${Math.floor(window.player.hunger)} / ${window.player.maxHunger}`);
    elTxt('level-text', window.player.level); elW('xp-fill', `${(window.player.xp / window.player.maxXp) * 100}%`); elTxt('xp-text', `${Math.floor(window.player.xp)} / ${window.player.maxXp}`);

    const checkBtn = (idReq, idBtn, w, s, web, intR, t) => {
        let reqDOM = window.getEl(idReq), btnDOM = window.getEl(idBtn);
        if (!window.player.toolbar) window.player.toolbar = ['hand'];
        if (!window.player.availableTools) window.player.availableTools = ['hand'];
        
        let hasIt = t && (window.player.toolbar.includes(t) || window.player.availableTools.includes(t));
        
        if(reqDOM) reqDOM.innerHTML = hasIt ? '<span style="color:#4CAF50">Fabricado</span>' : window.getReqText(w, s, web, intR);
        if(btnDOM) btnDOM.disabled = window.player.inventory.wood<w || (window.player.inventory.stone||0)<s || (window.player.inventory.web||0)<web || window.player.stats.int<intR || hasIt;
    };

    checkBtn('req-torch', 'btn-craft-torch', 5, 0, 2, 0, 'torch');
    checkBtn('req-barricade', 'btn-craft-barricade', 8, 4, 0, 0, null);
    checkBtn('req-axe', 'btn-craft-axe', 10, 0, 0, 0, 'axe'); checkBtn('req-pickaxe', 'btn-craft-pickaxe', 20, 0, 0, 0, 'pickaxe'); checkBtn('req-hammer', 'btn-craft-hammer', 15, 0, 0, 0, 'hammer'); checkBtn('req-bow', 'btn-craft-bow', 100, 0, 2, 0, 'bow'); checkBtn('req-sword', 'btn-craft-sword', 30, 30, 0, 3, 'sword'); checkBtn('req-box', 'btn-craft-box', 40, 0, 0, 1, null); checkBtn('req-campfire', 'btn-craft-campfire', 20, 5, 0, 0, null); checkBtn('req-bed', 'btn-craft-bed', 30, 0, 10, 0, null);
    ['btn-craft-arrow','btn-craft-arrow2','btn-craft-arrow5','btn-craft-arrow10'].forEach((id,i)=>{ let c=[5,10,25,50][i]; let b = window.getEl(id); if(b) b.disabled = window.player.inventory.wood < c; });
};

window.updateEntityHUD = function() {
    if(!window.getEl('entity-hud')) return;
    let html = '';
    window.entities.forEach(ent => {
        if (ent.hp < ent.maxHp && (Date.now() - (ent.lastHitTime || 0) < 3000) && ent.x + ent.width > window.camera.x && ent.x < window.camera.x + window.canvas.width) {
            let hpPercent = (ent.hp / ent.maxHp) * 100; let color = ent.type === 'spider' ? '#ff4444' : (ent.type === 'zombie' ? '#228b22' : (ent.type === 'archer' ? '#8e44ad' : '#ffaa00'));
            html += `<div class="entity-bar-container"><div class="entity-info"><span>${ent.name} (Nv. ${ent.level})</span><span>${Math.max(0, Math.floor(ent.hp))}/${ent.maxHp}</span></div><div class="entity-hp-bg"><div class="entity-hp-fill" style="width: ${hpPercent}%; background: ${color}"></div></div></div>`;
        }
    });
    window.getEl('entity-hud').innerHTML = html;
};

window.bindCraft = function(id, fn) { const el = window.getEl(id); if(el) el.addEventListener('click', fn); };
window.craftItem = function(reqW, reqS, reqWeb, reqInt, tool, item, amt=1) {
    if(window.player.inventory.wood >= reqW && (window.player.inventory.stone||0) >= reqS && (window.player.inventory.web||0) >= reqWeb && window.player.stats.int >= reqInt) {
        if(tool && !window.player.toolbar.includes(tool)) { 
            window.player.inventory.wood-=reqW; window.player.inventory.stone-=reqS; window.player.inventory.web-=reqWeb; 
            window.player.toolHealth[tool] = window.toolMaxDurability[tool]; 
            if (!window.player.availableTools.includes(tool)) window.player.availableTools.push(tool);
            if(typeof window.autoEquip === 'function') window.autoEquip(tool);
        } 
        else if(item) { 
            if (!window.canAddItem(item, amt)) { window.spawnDamageText(window.player.x + window.player.width/2, window.player.y - 20, "Inventario Lleno", '#fff'); return; }
            window.player.inventory.wood-=reqW; window.player.inventory.stone-=reqS; window.player.inventory.web-=reqWeb; window.player.inventory[item] = (window.player.inventory[item]||0) + amt; 
            if (['boxes', 'campfire_item', 'bed_item', 'barricade_item'].includes(item) && typeof window.autoEquip === 'function') window.autoEquip(item);
        }
        window.updateUI(); if(typeof window.renderToolbar === 'function') window.renderToolbar();
    }
};

window.bindCraft('btn-craft-torch', () => window.craftItem(5, 0, 2, 0, 'torch', null)); 
window.bindCraft('btn-craft-axe', () => window.craftItem(10, 0, 0, 0, 'axe', null)); 
window.bindCraft('btn-craft-pickaxe', () => window.craftItem(20, 0, 0, 0, 'pickaxe', null)); 
window.bindCraft('btn-craft-hammer', () => window.craftItem(15, 0, 0, 0, 'hammer', null)); 
window.bindCraft('btn-craft-bow', () => window.craftItem(100, 0, 2, 0, 'bow', null)); 
window.bindCraft('btn-craft-sword', () => window.craftItem(30, 30, 0, 3, 'sword', null)); 
window.bindCraft('btn-craft-box', () => window.craftItem(40, 0, 0, 1, null, 'boxes')); 
window.bindCraft('btn-craft-campfire', () => window.craftItem(20, 5, 0, 0, null, 'campfire_item')); 
window.bindCraft('btn-craft-bed', () => window.craftItem(30, 0, 10, 0, null, 'bed_item'));
window.bindCraft('btn-craft-arrow', () => window.craftItem(5, 0, 0, 0, null, 'arrows', 1)); 
window.bindCraft('btn-craft-arrow2', () => window.craftItem(10, 0, 0, 0, null, 'arrows', 2)); 
window.bindCraft('btn-craft-arrow5', () => window.craftItem(25, 0, 0, 0, null, 'arrows', 5)); 
window.bindCraft('btn-craft-arrow10', () => window.craftItem(50, 0, 0, 0, null, 'arrows', 10));
window.bindCraft('btn-craft-barricade', () => window.craftItem(8, 4, 0, 0, null, 'barricade_item', 1));