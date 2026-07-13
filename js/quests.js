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

// Branch definitions preserve legacy IDs while teaching progression without
// granting materials above the tier being demonstrated.
const QUEST_DEFS = [
 {id:'first-steps',branch:'Survival',title:'First Steps',description:'Gather 3 candy logs',target:3,event:'blockBroken',filter:WOOD,reward:{id:PLANKS,count:6,name:'Planks'}},
 {id:'workbench',branch:'Survival',title:'A Place to Make',description:'Craft a workbench',target:1,event:'itemCrafted',filter:CRAFTING_TABLE,deps:['first-steps'],reward:{id:ITEM_STICK,count:4,name:'Sticks'}},
 {id:'tool-time',branch:'Survival',title:'Tool Time',description:'Craft a wooden tool',target:1,event:'itemCrafted',filter:ITEM_WOOD_PICKAXE,deps:['workbench'],reward:{id:ITEM_COOKIE,count:2,name:'Cookies'}},
 {id:'first-shelter',branch:'Survival',title:'First Shelter',description:'Place 12 blocks',target:12,event:'blockPlaced',deps:['tool-time'],reward:{id:LOLLIPOP_LAMP,count:2,name:'Lollipop Lamps'}},
 {id:'oven-ready',branch:'Survival',title:'Warm Oven',description:'Smelt your first ingredient',target:1,event:'ovenSmelted',deps:['first-shelter'],reward:{id:ITEM_SUGAR,count:3,name:'Sugar'}},
 {id:'sleep-tight',branch:'Survival',title:'Sleep Tight',description:'Sleep in a marshmallow bed',target:1,event:'playerSlept',deps:['first-shelter'],reward:{id:LOLLIPOP_LAMP,count:2,name:'Lollipop Lamps'}},
 {id:'deep-discovery',branch:'Survival',title:'Deep Discovery',description:'Reach the underground Deep Dark',target:1,event:'deepDarkVisited',deps:['oven-ready'],reward:{id:ITEM_IRON_INGOT,count:2,name:'Iron Ingots'}},
 {id:'explorer',branch:'Explorer',title:'Flavor Tour',description:'Visit 3 different biomes',target:3,event:'biomeVisited',unique:'biome',reward:{id:ITEM_COOKIE,count:4,name:'Cookies'}},
 {id:'structure-scout',branch:'Explorer',title:'Sweet Landmark',description:'Discover a generated structure',target:1,event:'structureDiscovered',deps:['explorer'],reward:{id:ITEM_LAPIS_GEM,count:2,name:'Lapis Gems'}},
 {id:'treasure-hunter',branch:'Explorer',title:'Contained Treasure',description:'Open a structure treasure chest',target:1,event:'structureLootOpened',deps:['structure-scout'],reward:{id:ITEM_GOLD_INGOT,count:1,name:'Gold Ingot'}},
 {id:'first-builder',branch:'Builder',title:'Builder Basics',description:'Place 5 blocks',target:5,event:'blockPlaced',reward:{id:GLASS,count:6,name:'Glass'}},
 {id:'master-builder',branch:'Builder',title:'Cozy Base',description:'Place 50 blocks',target:50,event:'blockPlaced',deps:['first-builder'],reward:{id:CANDY_SIGN,count:2,name:'Candy Signs'}},
 {id:'storage-smart',branch:'Builder',title:'Storage Smart',description:'Open a cupcake chest',target:1,event:'chestOpened',deps:['first-builder'],reward:{id:CUPCAKE_CHEST,count:1,name:'Cupcake Chest'}},
 {id:'sweet-tooth',branch:'Chef',title:'Sweet Tooth',description:'Craft 3 treats',target:3,event:'treatCrafted',reward:{id:ITEM_SUGAR,count:5,name:'Sugar'}},
 {id:'candy-chef',branch:'Chef',title:'Candy Chef',description:'Craft four different treats',target:4,event:'treatCrafted',unique:'itemId',deps:['sweet-tooth'],reward:{id:SPRINKLE,count:12,name:'Sprinkles'}},
 {id:'farm-start',branch:'Chef',title:'Renewable Sweets',description:'Plant 3 crops',target:3,event:'cropPlanted',deps:['sweet-tooth'],reward:{id:ITEM_COOKIE_SEEDS,count:4,name:'Cookie-Wheat Seeds'}},
 {id:'farm-harvest',branch:'Chef',title:'Home Harvest',description:'Harvest 3 mature crops',target:3,event:'cropHarvested',deps:['farm-start'],reward:{id:ITEM_FLOUR,count:4,name:'Flour'}},
 {id:'mechanic-start',branch:'Mechanic',title:'Sugar Switch',description:'Place a sugar switch',target:1,event:'blockPlaced',filter:SUGAR_SWITCH,reward:{id:JELLY_WIRE,count:8,name:'Jelly Wire'}},
 {id:'mechanic-light',branch:'Mechanic',title:'Light It Up',description:'Power a lollipop lamp',target:1,event:'mechanismPowered',filter:LOLLIPOP_LAMP,deps:['mechanic-start'],reward:{id:DELAY_CANDY,count:2,name:'Delay Candy'}},
 {id:'mechanic-door',branch:'Mechanic',title:'Automatic Welcome',description:'Power a wafer door',target:1,event:'mechanismPowered',filter:WAFER_DOOR,deps:['mechanic-light'],reward:{id:NOTE_CANDY,count:2,name:'Note Candy'}},
 {id:'animal-friend',branch:'Pet',title:'Animal Friend',description:'Tame any animal',target:1,event:'petTamed',reward:{id:ITEM_CUPCAKE,count:3,name:'Cupcakes'}},
 {id:'mythical-companion',branch:'Pet',title:'Mythical Companion',description:'Tame a unicorn',target:1,event:'unicornTamed',deps:['animal-friend'],reward:{id:ITEM_GUMMY_BERRIES,count:5,name:'Gummy Berries'}},
 {id:'family-pen',branch:'Pet',title:'Growing Family',description:'Breed a pair of animals',target:1,event:'animalBred',deps:['animal-friend'],reward:{id:CANDY_FENCE,count:8,name:'Candy Fences'}},
 {id:'trader',branch:'Explorer',title:'Friendly Trader',description:'Complete 3 villager trades',target:3,event:'tradeCompleted',reward:{id:ITEM_GOLD_INGOT,count:2,name:'Gold Ingots'}},
 {id:'creative-spirit',branch:'Builder',title:'Creative Spirit',description:'Try Creative mode',target:1,event:'creativeToggled',creative:true,reward:null}
];
const QUEST_BRANCH_ORDER=['Survival','Explorer','Builder','Chef','Mechanic','Pet'];
QUEST_DEFS.sort((a,b)=>QUEST_BRANCH_ORDER.indexOf(a.branch)-QUEST_BRANCH_ORDER.indexOf(b.branch));

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
        branch:def.branch,deps:def.deps||[],event:def.event,filter:def.filter,unique:[],discovered:!(def.deps&&def.deps.length),craftedTreatTypes:[]
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
    const aliases={'place-block':'blockPlaced','craft-treat':'treatCrafted','visit-biome':'biomeVisited','visit-deep-dark':'deepDarkVisited','tame-animal':'petTamed','tame-unicorn':'unicornTamed','complete-trade':'tradeCompleted','toggle-creative':'creativeToggled'};
    eventType=aliases[eventType]||eventType;
    if(eventType==='treatCrafted'&&typeof data==='number')data={itemId:data};
    if(eventType==='biomeVisited'&&typeof data==='number')data={value:data,biome:data};
    for (var i = 0; i < QUESTS.length; i++) {
        var quest = QUESTS[i],def=QUEST_DEFS[i];
        if(game.worldMode==='creative'&&!def.creative)continue;
        const unlocked=quest.deps.every(id=>getQuestById(id)?.completed);
        quest.discovered=quest.discovered||unlocked;
        if(!unlocked||def.event!==eventType)continue;
        const filterValue=data&&typeof data==='object'?(data.itemId??data.blockId??data.type):data;
        if(def.filter!=null&&filterValue!==def.filter)continue;
        const before=quest.completed,next=CandyCore.advanceQuestState(def,quest,eventType,data,true);
        quest.progress=next.progress;quest.completed=next.completed;quest.unique=next.unique;quest.craftedTreatTypes=next.unique;
        CandyEvents.emit('questAdvanced',{questId:quest.id,progress:quest.progress});
        if(!before&&quest.completed){grantQuestReward(quest);showQuestNotification('Quest complete: '+quest.title+'!');}
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
    CandyEvents.emit('biomeVisited',{biome:biomeId,value:game.visitedBiomes.length});

    if (biomeId === BIOME_DEEP_DARK) {
        CandyEvents.emit('deepDarkVisited',{biome:biomeId});
    }
}

function trackStructureDiscovery(){if(!Array.isArray(game.generatedStructures))return;for(const structure of game.generatedStructures){if(structure.discovered)continue;if((structure.x-game.player.x)**2+(structure.z-game.player.z)**2<=14**2){structure.discovered=true;CandyEvents.emit('structureDiscovered',{family:structure.family,position:structure});showQuestNotification('Discovered: '+structure.family.replaceAll('-',' ')+'!');}}}

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

    var currentBranch='';
    for (var i = 0; i < QUESTS.length; i++) {
        var quest = QUESTS[i];
        if(quest.branch!==currentBranch){currentBranch=quest.branch;var heading=document.createElement('h4');heading.className='quest-branch';heading.textContent=currentBranch;list.appendChild(heading);}
        var entry = document.createElement('div');
        entry.className = 'quest-entry' + (quest.completed ? ' completed' : '') + (!quest.discovered?' locked':'');

        // Title
        var title = document.createElement('div');
        title.className = 'quest-title';
        title.textContent = quest.title;
        entry.appendChild(title);

        // Description
        var desc = document.createElement('div');
        desc.className = 'quest-description';
        desc.textContent = game.worldMode==='creative'&&!QUEST_DEFS[i].creative?'Available in Survival or Cozy worlds':quest.discovered?quest.description:'Complete: '+quest.deps.map(id=>getQuestById(id)?.title||id).join(', ');
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
            craftedTreatTypes: q.craftedTreatTypes || [],
            unique:q.unique||[],discovered:!!q.discovered
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
            q.discovered=!!saved.discovered||q.discovered;
            if (q.progress >= q.target) q.completed = true;
            if (Array.isArray(saved.craftedTreatTypes)) {
                q.craftedTreatTypes = [];
                for (var j = 0; j < saved.craftedTreatTypes.length; j++) {
                    var treatId = saved.craftedTreatTypes[j];
                    if (Number.isInteger(treatId) && typeof isTreatItem === 'function' && isTreatItem(treatId) && q.craftedTreatTypes.indexOf(treatId) < 0) {
                        q.craftedTreatTypes.push(treatId);
                    }
                }
                q.unique=q.craftedTreatTypes.slice();
            }
            if(Array.isArray(saved.unique))q.unique=saved.unique.slice(0,32);
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

for(const type of ['blockBroken','blockPlaced','itemCrafted','ovenSmelted','playerSlept','biomeVisited','deepDarkVisited','structureDiscovered','structureLootOpened','chestOpened','cropPlanted','cropHarvested','mechanismPowered','petTamed','unicornTamed','animalBred','tradeCompleted','creativeToggled'])CandyEvents.on(type,data=>{advanceQuest(type,data);if(type==='itemCrafted'&&isTreatItem(data?.itemId))advanceQuest('treatCrafted',data);});

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
