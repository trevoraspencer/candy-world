'use strict';

// ====== QUEST BOOK SYSTEM ======
// 10 kid-friendly quests tracking real game actions.
// Quest progress is driven by hooks called from existing systems:
//   advanceQuest('place-block')        — input.js handlePlaceAction
//   advanceQuest('craft-treat', id)    — crafting.js doCraft
//   advanceQuest('visit-biome', n)     — player.js updatePlayer (biome tracker)
//   advanceQuest('visit-deep-dark')    — player.js updatePlayer
//   advanceQuest('tame-animal')        — mobs.js tameAnimal
//   advanceQuest('tame-unicorn')       — mobs.js tameAnimal
//   advanceQuest('complete-trade')     — mobs.js trade click handler
//   advanceQuest('toggle-creative')    — player.js toggleCreativeMode

// game.questPanelOpen, game.visitedBiomes, game.pendingQuestRewards are now game.* (initialized in state.js)

// Quest data structure — persisted in save data
const QUEST_DEFS = [
    {
        id: 'first-steps',
        title: 'First Steps',
        description: 'Place 5 blocks in the world',
        target: 5,
        trackEvent: 'place-block',
        reward: { id: PLANKS, count: 10, name: 'Planks' }
    },
    {
        id: 'sweet-tooth',
        title: 'Sweet Tooth',
        description: 'Craft 3 treats',
        target: 3,
        trackEvent: 'craft-treat',
        reward: { id: ITEM_SUGAR, count: 5, name: 'Sugar' }
    },
    {
        id: 'explorer',
        title: 'Explorer',
        description: 'Visit 3 different biomes',
        target: 3,
        trackEvent: 'visit-biome',
        reward: { id: ITEM_IRON_INGOT, count: 5, name: 'Iron Ingots' }
    },
    {
        id: 'animal-friend',
        title: 'Animal Friend',
        description: 'Tame any animal',
        target: 1,
        trackEvent: 'tame-animal',
        reward: { id: ITEM_CUPCAKE, count: 5, name: 'Cupcakes' }
    },
    {
        id: 'mythical-companion',
        title: 'Mythical Companion',
        description: 'Tame a unicorn',
        target: 1,
        trackEvent: 'tame-unicorn',
        reward: { id: ITEM_DIAMOND_GEM, count: 5, name: 'Diamonds' }
    },
    {
        id: 'master-builder',
        title: 'Master Builder',
        description: 'Place 50 blocks',
        target: 50,
        trackEvent: 'place-block',
        reward: { id: GLASS, count: 20, name: 'Glass' }
    },
    {
        id: 'candy-chef',
        title: 'Candy Chef',
        description: 'Craft one of each treat type',
        target: 4,
        trackEvent: 'craft-treat-type',
        reward: { id: SPRINKLE, count: 20, name: 'Sprinkles' }
    },
    {
        id: 'trader',
        title: 'Trader',
        description: 'Complete 3 villager trades',
        target: 3,
        trackEvent: 'complete-trade',
        reward: { id: ITEM_GOLD_INGOT, count: 5, name: 'Gold Ingots' }
    },
    {
        id: 'deep-discovery',
        title: 'Deep Discovery',
        description: 'Visit the Deep Dark biome',
        target: 1,
        trackEvent: 'visit-deep-dark',
        reward: { id: REDSTONE_ORE, count: 10, name: 'Redstone' }
    },
    {
        id: 'creative-spirit',
        title: 'Creative Spirit',
        description: 'Toggle Creative Mode',
        target: 1,
        trackEvent: 'toggle-creative',
        reward: null // sparkle effect reward
    }
];

// Runtime quest state — index matches QUEST_DEFS
const QUESTS = QUEST_DEFS.map(function(def) {
    return {
        id: def.id,
        title: def.title,
        description: def.description,
        target: def.target,
        progress: 0,
        completed: false,
        reward: def.reward,
        trackEvent: def.trackEvent,
        craftedTreatTypes: [] // only used for candy-chef quest
    };
});

function getQuestById(id) {
    for (var i = 0; i < QUESTS.length; i++) {
        if (QUESTS[i].id === id) return QUESTS[i];
    }
    return null;
}

// ====== QUEST PROGRESS ENGINE ======
function advanceQuest(eventType, data) {
    for (var i = 0; i < QUESTS.length; i++) {
        var quest = QUESTS[i];
        if (quest.completed) continue;

        var match = false;

        switch (eventType) {
            case 'place-block':
                if (quest.trackEvent === 'place-block') {
                    quest.progress++;
                    match = true;
                }
                break;

            case 'craft-treat':
                if (quest.trackEvent === 'craft-treat') {
                    quest.progress++;
                    match = true;
                }
                // Also check craft-treat-type for candy-chef quest
                if (quest.trackEvent === 'craft-treat-type' && typeof data === 'number') {
                    var found = false;
                    for (var j = 0; j < quest.craftedTreatTypes.length; j++) {
                        if (quest.craftedTreatTypes[j] === data) { found = true; break; }
                    }
                    if (!found) {
                        quest.craftedTreatTypes.push(data);
                    }
                    quest.progress = quest.craftedTreatTypes.length;
                    match = true;
                }
                break;

            case 'visit-biome':
                if (quest.trackEvent === 'visit-biome') {
                    quest.progress = data; // data = game.visitedBiomes.length
                    match = true;
                }
                break;

            case 'visit-deep-dark':
                if (quest.trackEvent === 'visit-deep-dark') {
                    quest.progress = 1;
                    match = true;
                }
                break;

            case 'tame-animal':
                if (quest.trackEvent === 'tame-animal') {
                    quest.progress++;
                    match = true;
                }
                break;

            case 'tame-unicorn':
                if (quest.trackEvent === 'tame-unicorn') {
                    quest.progress = 1;
                    match = true;
                }
                break;

            case 'complete-trade':
                if (quest.trackEvent === 'complete-trade') {
                    quest.progress++;
                    match = true;
                }
                break;

            case 'toggle-creative':
                if (quest.trackEvent === 'toggle-creative') {
                    quest.progress = 1;
                    match = true;
                }
                break;
        }

        if (match && !quest.completed && quest.progress >= quest.target) {
            quest.completed = true;
            grantQuestReward(quest);
        }
    }
    if (typeof scheduleSaveGame === 'function') scheduleSaveGame();
}

function grantQuestReward(quest) {
    if (!quest.reward) {
        // Sparkle effect for creative spirit
        if (typeof addEffect === 'function') {
            addEffect(EFFECT_SPARKLE, 30);
        }
        return;
    }
    if (typeof addItem === 'function') {
        var added = addItem(quest.reward.id, quest.reward.count);
        if (!added) {
            // Inventory full — queue the reward so it's not lost
            game.pendingQuestRewards.push({
                id: quest.reward.id,
                count: quest.reward.count,
                name: quest.reward.name,
                questTitle: quest.title
            });
            showQuestNotification('Inventory full! Reward for "' + quest.title + '" will be added when there is space.');
        }
    }
}

function isQuestSaveObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeQuestReward(reward) {
    if (!isQuestSaveObject(reward)) return null;
    if (!Number.isInteger(reward.id) || reward.id <= AIR || typeof BLOCK_NAMES[reward.id] !== 'string') return null;
    if (!Number.isInteger(reward.count) || reward.count <= 0) return null;
    var maxStack = typeof getItemMaxStack === 'function' ? getItemMaxStack(reward.id) : 64;
    return {
        id: reward.id,
        count: Math.min(reward.count, maxStack),
        name: typeof reward.name === 'string' && reward.name ? reward.name.slice(0, 40) : BLOCK_NAMES[reward.id],
        questTitle: typeof reward.questTitle === 'string' ? reward.questTitle.slice(0, 80) : ''
    };
}

// ====== BIOME VISIT TRACKING ======
function trackBiomeVisit(biomeId) {
    for (var i = 0; i < game.visitedBiomes.length; i++) {
        if (game.visitedBiomes[i] === biomeId) return; // already visited
    }
    game.visitedBiomes.push(biomeId);
    advanceQuest('visit-biome', game.visitedBiomes.length);

    if (biomeId === BIOME_DEEP_DARK) {
        advanceQuest('visit-deep-dark');
    }
}

// ====== PENDING REWARD RECOVERY ======
function tryGrantPendingRewards() {
    if (game.pendingQuestRewards.length === 0) return;
    var remaining = [];
    for (var i = 0; i < game.pendingQuestRewards.length; i++) {
        var reward = sanitizeQuestReward(game.pendingQuestRewards[i]);
        if (!reward) continue;
        if (typeof canAddItem === 'function' && canAddItem(reward.id, reward.count)) {
            if (typeof addItem === 'function') {
                addItem(reward.id, reward.count);
                showQuestNotification('Reward received: ' + reward.count + ' ' + reward.name + '!');
            }
        } else {
            remaining.push(reward);
        }
    }
    game.pendingQuestRewards = remaining;
    if (typeof scheduleSaveGame === 'function') scheduleSaveGame();
}

// ====== QUEST NOTIFICATION TOAST ======
var questNotificationTimer = null;
function showQuestNotification(message) {
    var toast = document.getElementById('quest-notification');
    if (!toast) return;
    toast.textContent = message;
    toast.style.display = 'block';
    toast.style.opacity = '1';
    if (questNotificationTimer) clearTimeout(questNotificationTimer);
    questNotificationTimer = setTimeout(function() {
        toast.style.opacity = '0';
        setTimeout(function() {
            toast.style.display = 'none';
        }, 400);
    }, 4000);
}

// ====== QUEST PANEL UI ======
function updateQuestPanel() {
    var list = document.getElementById('quest-list');
    if (!list) return;
    list.innerHTML = '';

    for (var i = 0; i < QUESTS.length; i++) {
        var quest = QUESTS[i];
        var entry = document.createElement('div');
        entry.className = 'quest-entry' + (quest.completed ? ' completed' : '');

        // Title
        var title = document.createElement('div');
        title.className = 'quest-title';
        title.textContent = quest.title;
        entry.appendChild(title);

        // Description
        var desc = document.createElement('div');
        desc.className = 'quest-description';
        desc.textContent = quest.description;
        entry.appendChild(desc);

        // Progress bar
        var barOuter = document.createElement('div');
        barOuter.className = 'quest-progress-bar';
        var barInner = document.createElement('div');
        barInner.className = 'quest-progress-fill';
        var pct = Math.min(100, (quest.progress / quest.target) * 100);
        barInner.style.width = pct + '%';
        barOuter.appendChild(barInner);
        entry.appendChild(barOuter);

        // Progress text
        var progressText = document.createElement('div');
        progressText.className = 'quest-progress-text';
        progressText.textContent = Math.min(quest.progress, quest.target) + ' / ' + quest.target;
        entry.appendChild(progressText);

        // Reward / completed state
        var rewardDiv = document.createElement('div');
        rewardDiv.className = 'quest-reward';
        if (quest.completed) {
            rewardDiv.textContent = '\u2714 Complete!';
            rewardDiv.classList.add('quest-reward-complete');
        } else if (quest.reward) {
            rewardDiv.textContent = 'Reward: ' + quest.reward.count + ' ' + quest.reward.name;
        } else {
            rewardDiv.textContent = 'Reward: Sparkle Effect';
        }
        entry.appendChild(rewardDiv);

        list.appendChild(entry);
    }

    // Show pending rewards if any
    if (game.pendingQuestRewards.length > 0) {
        var pendingDiv = document.createElement('div');
        pendingDiv.className = 'quest-pending-rewards';
        pendingDiv.textContent = '🎁 ' + game.pendingQuestRewards.length + ' reward(s) waiting — free up inventory space!';
        list.appendChild(pendingDiv);
    }
}

function toggleQuestPanel() {
    game.questPanelOpen = !game.questPanelOpen;
    var overlay = document.getElementById('quest-overlay');
    if (game.questPanelOpen) {
        // Try to grant any pending rewards before showing panel
        if (typeof tryGrantPendingRewards === 'function') tryGrantPendingRewards();
        updateQuestPanel();
        overlay.style.display = 'flex';
        if (typeof exitGamePointerLock === 'function') exitGamePointerLock();
        else if (document.exitPointerLock) document.exitPointerLock();
    } else {
        overlay.style.display = 'none';
        if (typeof requestGamePointerLock === 'function') requestGamePointerLock();
        else if (game.canvas.requestPointerLock) game.canvas.requestPointerLock();
    }
}

// ====== QUEST PERSISTENCE HELPERS ======
function getQuestSaveData() {
    var data = {};
    for (var i = 0; i < QUESTS.length; i++) {
        var q = QUESTS[i];
        data[q.id] = {
            progress: q.progress,
            completed: q.completed,
            craftedTreatTypes: q.craftedTreatTypes || []
        };
    }
    data._pendingRewards = game.pendingQuestRewards.slice();
    return data;
}

function loadQuestSaveData(data) {
    if (!isQuestSaveObject(data)) return;
    for (var i = 0; i < QUESTS.length; i++) {
        var q = QUESTS[i];
        var saved = data[q.id];
        if (isQuestSaveObject(saved)) {
            q.progress = Number.isFinite(saved.progress) ? Math.max(0, Math.min(q.target, Math.floor(saved.progress))) : 0;
            q.completed = !!saved.completed;
            if (q.progress >= q.target) q.completed = true;
            if (Array.isArray(saved.craftedTreatTypes)) {
                q.craftedTreatTypes = [];
                for (var j = 0; j < saved.craftedTreatTypes.length; j++) {
                    var treatId = saved.craftedTreatTypes[j];
                    if (Number.isInteger(treatId) && typeof isTreatItem === 'function' && isTreatItem(treatId) && q.craftedTreatTypes.indexOf(treatId) < 0) {
                        q.craftedTreatTypes.push(treatId);
                    }
                }
            }
        }
    }
    // Restore pending rewards
    if (Array.isArray(data._pendingRewards)) {
        game.pendingQuestRewards = [];
        for (var k = 0; k < data._pendingRewards.length; k++) {
            var reward = sanitizeQuestReward(data._pendingRewards[k]);
            if (reward) game.pendingQuestRewards.push(reward);
        }
    }
}

// Close button handler
var questCloseBtn = document.getElementById('quest-close');
if (questCloseBtn) {
    questCloseBtn.addEventListener('click', function() {
        if (game.questPanelOpen) toggleQuestPanel();
    });
}

// Quest book icon in HUD
var questBookBtn = document.getElementById('quest-book-btn');
if (questBookBtn) {
    questBookBtn.addEventListener('click', function() {
        if (game.questPanelOpen) return;
        if (typeof game.inventoryOpen !== 'undefined' && game.inventoryOpen) return;
        if (typeof game.tradeTarget !== 'undefined' && game.tradeTarget) return;
        if (typeof game.petPanelOpen !== 'undefined' && game.petPanelOpen) return;
        toggleQuestPanel();
    });
}
