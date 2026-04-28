// ==UserScript==
// @name             HWH Daily Dashboard
// @name:en          HWH Daily Dashboard
// @name:ru          HWH Ежедневная панель
// @namespace        HWH_DailyDashboard
// @version          1.14.1
// @description      Ultimate daily dashboard: Auto-run, Smart Energy Loop, Item Exchange, and Forensic Activity Check with Retry Loop.
// @author           HWH Extension Architect
// @match            https://www.hero-wars.com/*
// @match            https://apps-1701433570146040.apps.fbsbx.com/*
// @grant            unsafeWindow
// @grant            GM_setValue
// @grant            GM_getValue
// @run-at           document-start
// ==/UserScript==

(function () {
    'use strict';

    const loader = setInterval(() => {
        if (typeof unsafeWindow.HWHClasses !== 'undefined' && typeof unsafeWindow.HWHData !== 'undefined' && typeof unsafeWindow.Caller !== 'undefined') {
            clearInterval(loader);
            setTimeout(init, 1000);
        }
    }, 500);

    // Global reference to the original quest button config
    let originalQuestConfig = null;

    async function init() {
        const { HWHData, HWHFuncs, Caller, lib, cheats } = unsafeWindow;
        const { othersPopupButtons } = HWHData;
        const { popup, setProgress, I18N, getSaveVal, setSaveVal } = HWHFuncs;

        console.log('%c[HWH Daily Dashboard] Script initialized (v1.14.1).', 'color: #00bcd4; font-weight: bold;');

        // @AI-HIGHLIGHT: Session variable to track if the popup has been opened at least once since page load (F5 resets this)
        let hasPopupOpenedThisSession = false;

        // --- @SECTION: DB CLASS ---
        class HWHExtensionDB {
            constructor(dbName, storeName) {
                this.dbName = dbName;
                this.storeName = storeName;
                this.db = null;
            }
            async open() {
                return new Promise((resolve, reject) => {
                    let request = indexedDB.open(this.dbName);
                    request.onsuccess = (e) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains(this.storeName)) {
                            const version = db.version + 1;
                            db.close();
                            const upgradeReq = indexedDB.open(this.dbName, version);
                            upgradeReq.onupgradeneeded = (evt) => {
                                evt.target.result.createObjectStore(this.storeName);
                            };
                            upgradeReq.onsuccess = (evt) => {
                                this.db = evt.target.result;
                                resolve();
                            };
                            upgradeReq.onerror = (err) => reject(err);
                        } else {
                            this.db = db;
                            resolve();
                        }
                    };
                    request.onerror = (e) => reject(e);
                    request.onupgradeneeded = (e) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains(this.storeName)) {
                            db.createObjectStore(this.storeName);
                        }
                    };
                });
            }
            async get(key, def) {
                return new Promise(async (resolve) => {
                    try {
                        if (!this.db) await this.open();
                        const transaction = this.db.transaction([this.storeName], 'readonly');
                        const request = transaction.objectStore(this.storeName).get(key);
                        request.onsuccess = () => resolve(request.result === undefined ? def : request.result);
                        request.onerror = () => resolve(def);
                    } catch (e) {
                        resolve(def);
                    }
                });
            }
            async set(key, value) {
                return new Promise(async (resolve, reject) => {
                    try {
                        if (!this.db) await this.open();
                        const transaction = this.db.transaction([this.storeName], 'readwrite');
                        const request = transaction.objectStore(this.storeName).put(value, key);
                        transaction.oncomplete = () => resolve();
                        transaction.onerror = (e) => reject(e);
                    } catch (e) {
                        reject(e);
                    }
                });
            }
        }
        const extDB = new HWHExtensionDB('HeroWarsHelper', 'settings');

        async function getUserId() {
            const cached = HWHFuncs.getUserInfo();
            if (cached && cached.id) return cached.id;
            try {
                const data = await Caller.send("userGetInfo");
                return data?.id || 0;
            } catch(e) {
                return 0;
            }
        }

        // --- @SECTION: API FOR UI ---
        unsafeWindow.HWH_Dashboard_API = {
            getUIOptions: () => ({
                checkActivity: document.getElementById('db_act').checked,
                checkGlyph: document.getElementById('db_gly').checked,
                checkRefills: document.getElementById('db_ref').checked,
                checkCampaignEnergy: document.getElementById('db_nrg').checked,
                autoRun: document.getElementById('db_auto_dash').checked, // legacy mapping
                autoDash: document.getElementById('db_auto_dash').checked,
                autoExec: document.getElementById('db_auto_exec').checked,
                seqSpend: document.getElementById('db_seq_spend').checked,
                seqBuy: document.getElementById('db_seq_buy').checked,
                seqGlyph: document.getElementById('db_seq_glyph').checked,
                seqGlyphTimer: document.getElementById('db_seq_glyph_timer').checked,
                seqExch: document.getElementById('db_seq_exch').checked
            }),
            run: () => {
                const opt = unsafeWindow.HWH_Dashboard_API.getUIOptions();
                const btn = document.querySelector('.PopUp_closeBtn');
                if(btn) btn.click();
                runChecks(opt, true);
            },
            save: async () => {
                const opt = unsafeWindow.HWH_Dashboard_API.getUIOptions();
                const userId = await getUserId();
                const allSettings = await extDB.get(userId, {});
                allSettings.dailyDashboard = {
                    act: opt.checkActivity, gly: opt.checkGlyph, ref: opt.checkRefills, nrg: opt.checkCampaignEnergy,
                    autoDash: opt.autoDash, autoExec: opt.autoExec,
                    seqSpend: opt.seqSpend, seqBuy: opt.seqBuy, seqGlyph: opt.seqGlyph, 
                    seqGlyphTimer: opt.seqGlyphTimer, seqExch: opt.seqExch
                };
                await extDB.set(userId, allSettings);
                setProgress("Saved for Account / Сохранено для аккаунта", 3000);
            },
            setDefault: () => {
                const opt = unsafeWindow.HWH_Dashboard_API.getUIOptions();
                GM_setValue('db_act', opt.checkActivity);
                GM_setValue('db_gly', opt.checkGlyph);
                GM_setValue('db_ref', opt.checkRefills);
                GM_setValue('db_nrg', opt.checkCampaignEnergy);
                GM_setValue('db_auto_dash', opt.autoDash);
                GM_setValue('db_auto_exec', opt.autoExec);
                GM_setValue('db_seq_spend', opt.seqSpend);
                GM_setValue('db_seq_buy', opt.seqBuy);
                GM_setValue('db_seq_glyph', opt.seqGlyph);
                GM_setValue('db_seq_glyph_timer', opt.seqGlyphTimer);
                GM_setValue('db_seq_exch', opt.seqExch);
                setProgress("Defaults Saved / По умолчанию сохранено", 3000);
            },
            loadDefault: async () => {
                const userId = await getUserId();
                const allSettings = await extDB.get(userId, {});
                if (allSettings.dailyDashboard) {
                    delete allSettings.dailyDashboard;
                    await extDB.set(userId, allSettings);
                }
                setProgress("Defaults Loaded / Загружено по умолчанию", 3000);
                const btn = document.querySelector('.PopUp_closeBtn');
                if(btn) btn.click();
                setTimeout(openDashboardPopup, 300);
            }
        };

        // --- @SECTION: I18N DATA ---
        const i18nData = {
            en: {
                DASH_TITLE: 'Daily Dashboard',
                DASH_DESC: 'Select conditions to validate for item exchange.',
                LBL_ACT: 'Activity < 1750',
                LBL_GLYPH: 'Glyph Enchanted',
                LBL_REFILLS: 'Energy Refills (50)',
                LBL_ENERGY: 'Campaign Energy <= 120',
                LBL_AUTO_DASH: 'Auto Dashboard (Background Check)',
                LBL_AUTO_EXEC: 'Auto Execute Sequence',
                LBL_SHOW_BTN: 'Show "1750" Button',
                BTN_RUN: 'Run Pre-Check',
                BTN_FIX_GLYPH: 'Enchant Glyph',
                BTN_FIX_REFILLS: 'Buy Energy (Loop)',
                BTN_SPEND_ENERGY: 'Spend Energy (Monitor)',
                BTN_EXCHANGE: 'Item Exchange',
                BTN_SAVE_ACC: 'Save (Account)',
                BTN_LOAD_DEF: 'Load Default',
                BTN_SET_DEFAULT: 'Set as Default',
                STATUS_OK: 'Condition met',
                STATUS_NO: 'Condition NOT met',
                ALL_MET: 'ALL CONDITIONS MET!',
                NOT_MET: 'CONDITIONS NOT MET',
                WAIT_RECHECK: 'Action done. Re-checking in 1s...',
                STATUS_MONITORING: 'Monitoring energy... Re-check will run when stable.',
                EXCHANGE_SUCCESS: 'Activity Received: ',
                EXCHANGE_ERROR: 'Exchange Error: Check console',
                NO_ITEMS: 'No suitable items found (>200 qty, <4 val)',
                QUEST_SETTINGS: 'Dashboard Button Settings',
                QUEST_CONFIG: 'Dashboard Button Configuration',
                SEQ_TITLE: 'Auto-Execution Sequence',
                SEQ_SPEND: '1 - Spend Energy',
                SEQ_BUY: '2 - Buy Energy',
                SEQ_GLYPH: '3 - Enchant a Glyph',
                SEQ_GLYPH_TIMER: '3a - Glyph Timer (Safe Sync)',
                SEQ_EXCH: '4 - Item Exchange',
                WAIT_SYNC: 'Auto-Exec Paused: Waiting for Reset Sync'
            },
            ru: {
                DASH_TITLE: 'Ежедневная панель',
                DASH_DESC: 'Выберите условия для проверки обмена предметов.',
                LBL_ACT: 'Активность < 1750',
                LBL_GLYPH: 'Глиф зачарован',
                LBL_REFILLS: 'Покупки энергии (50)',
                LBL_ENERGY: 'Энергия кампании <= 120',
                LBL_AUTO_DASH: 'Авто-проверка панели',
                LBL_AUTO_EXEC: 'Авто-выполнение последовательности',
                LBL_SHOW_BTN: 'Показать кнопку "1750"',
                BTN_RUN: 'Запустить проверку',
                BTN_FIX_GLYPH: 'Зачаровать глиф',
                BTN_FIX_REFILLS: 'Купить энергию (Цикл)',
                BTN_SPEND_ENERGY: 'Потратить энергию (Монитор)',
                BTN_EXCHANGE: 'Обмен предметов',
                BTN_SAVE_ACC: 'Сохранить (Аккаунт)',
                BTN_LOAD_DEF: 'Сбросить (По умолчанию)',
                BTN_SET_DEFAULT: 'Сделать по умолчанию',
                STATUS_OK: 'Условие выполнено',
                STATUS_NO: 'Условие НЕ выполнено',
                ALL_MET: 'ВСЕ УСЛОВИЯ ВЫПОЛНЕНЫ!',
                NOT_MET: 'УСЛОВИЯ НЕ ВЫПОЛНЕНЫ',
                WAIT_RECHECK: 'Действие выполнено. Повторная проверка через 1 сек...',
                STATUS_MONITORING: 'Отслеживание энергии... Повторная проверка после стабилизации.',
                EXCHANGE_SUCCESS: 'Получено активности: ',
                EXCHANGE_ERROR: 'Ошибка обмена: проверьте консоль',
                NO_ITEMS: 'Подходящие предметы не найдены (>200 шт, <4 ценность)',
                QUEST_SETTINGS: 'Настройки кнопки панели',
                QUEST_CONFIG: 'Конфигурация кнопки панели',
                SEQ_TITLE: 'Авто-выполнение (Последовательность)',
                SEQ_SPEND: '1 - Потратить энергию',
                SEQ_BUY: '2 - Купить энергию',
                SEQ_GLYPH: '3 - Зачаровать глиф',
                SEQ_GLYPH_TIMER: '3a - Таймер глифа (Синхронизация)',
                SEQ_EXCH: '4 - Обмен предметов',
                WAIT_SYNC: 'Авто-выполнение приостановлено: Ожидание синхронизации сброса'
            }
        };

        Object.assign(HWHData.i18nLangData['en'], i18nData.en);
        Object.assign(HWHData.i18nLangData['ru'], i18nData.ru);

        const delay = ms => new Promise(res => setTimeout(res, ms));

        // --- @SECTION: ACTION LOGIC ---

        async function performItemExchange(neededActivity) {
            try {
                const inv = await Caller.send('inventoryGet');
                const itemsLib = lib.getData('inventoryItem');
                let itemsInfo =[];

                for (let type of ['gear', 'scroll']) {
                    for (let id in inv[type]) {
                        const v = itemsLib[type][id]?.enchantValue || 0;
                        itemsInfo.push({ id, count: inv[type][id], v, type });
                    }
                    const invType = 'fragment' + type.charAt(0).toUpperCase() + type.slice(1);
                    for (let id in inv[invType]) {
                        const v = itemsLib[type][id]?.fragmentEnchantValue || 0;
                        itemsInfo.push({ id, count: inv[invType][id], v, type: invType });
                    }
                }

                itemsInfo = itemsInfo.filter(e => e.v < 4 && e.count > 200).sort((a, b) => b.count - a.count);

                if (itemsInfo.length === 0) {
                    setProgress(I18N('NO_ITEMS'), 4000);
                    return;
                }

                const activeItem = itemsInfo[0];
                const countToExchange = Math.ceil(neededActivity / activeItem.v);

                if (countToExchange > activeItem.count) {
                    setProgress(I18N('EXCHANGE_ERROR'), 4000);
                    return;
                }

                const response = await Caller.send({
                    name: 'clanItemsForActivity',
                    args: { items: { [activeItem.type]: {[activeItem.id]: countToExchange } } }
                });

                setProgress(`${I18N('EXCHANGE_SUCCESS')} ${response}`, 5000);
                if (unsafeWindow.cheats?.refreshInventory) unsafeWindow.cheats.refreshInventory();
            } catch (err) {
                console.error('[HWH Dashboard] Exchange Error:', err);
                setProgress(I18N('EXCHANGE_ERROR'), 4000);
            }
        }

        async function performEnergyLoop() {
            let active = true;
            while (active) {
                const userInfo = await Caller.send('userGetInfo');
                const energyData = userInfo.refillable.find(item => item.id === 1);
                if (energyData && energyData.boughtToday < 2) {
                    await Caller.send('refillableBuyStamina');
                    await delay(1000);
                } else {
                    active = false;
                }
            }
            if (unsafeWindow.cheats?.refreshInventory) unsafeWindow.cheats.refreshInventory();
        }

        async function performGlyphFix() {
            const[heroes, inventory] = await Caller.send(['heroGetAll', 'inventoryGet']);
            let availableRuneId = 0;
            for (let i = 1; i <= 4; i++) {
                if (inventory.consumable && inventory.consumable[i] > 0) { availableRuneId = i; break; }
            }
            if (!availableRuneId) return;

            let cheapest = { heroId: 0, tier: -1, exp: 43750 };
            for (const hero of Object.values(heroes)) {
                if (!hero.runes) continue;
                for (const tier in hero.runes) {
                    const curExp = hero.runes[tier];
                    if (hero.color <[4, 4, 7, 8, 9][tier] || curExp >= 43750) continue;
                    if (curExp < cheapest.exp) cheapest = { heroId: hero.id, tier: parseInt(tier, 10), exp: curExp };
                }
            }
            if (cheapest.heroId) {
                await Caller.send({
                    name: "heroEnchantRune",
                    args: { heroId: cheapest.heroId, tier: cheapest.tier, items: { consumable: {[availableRuneId]: 1 } } }
                });
            }
        }

        function monitorEnergyAndRecheck(options) {
            setProgress(I18N('STATUS_MONITORING'), 5000);

            let lastEnergyValue = -1;
            let stableCount = 0;
            const STABILITY_CHECKS_NEEDED = 5;

            const monitorInterval = setInterval(async () => {
                try {
                    const userInfo = await Caller.send('userGetInfo');
                    const energyData = userInfo.refillable.find(item => item.id === 1);
                    const currentEnergy = energyData ? energyData.amount : 0;

                    if (currentEnergy <= 120) {
                        if (currentEnergy === lastEnergyValue) {
                            stableCount++;
                        } else {
                            lastEnergyValue = currentEnergy;
                            stableCount = 1;
                        }

                        if (stableCount >= STABILITY_CHECKS_NEEDED) {
                            console.log(`[HWH Dashboard] Energy stable at ${currentEnergy} for 2.5s. Triggering re-check.`);
                            clearInterval(monitorInterval);
                            setTimeout(() => runChecks(options, true), 200);
                        }
                    } else {
                        lastEnergyValue = -1;
                        stableCount = 0;
                    }
                } catch (error) {
                    console.error('[HWH Dashboard] Error during energy monitoring:', error);
                    clearInterval(monitorInterval);
                }
            }, 500);
        }

        // --- @SECTION: CORE LOGIC ---

        async function runChecks(options, isManual = false) {
            const[quests, userInfo, clanInfo] = await Caller.send(['questGetAll', 'userGetInfo', 'clanGetInfo']);

            const activityQuest = quests.find(q => q.id >= 10047 && q.id <= 10050);
            const totalActivity = activityQuest ? activityQuest.progress : 1750;

            const glyphAvailable = clanInfo.stat.activityForRuneAvailable;
            const energyData = userInfo.refillable.find(item => item.id === 1);
            const boughtToday = energyData ? energyData.boughtToday : 2;
            const currentEnergy = energyData ? energyData.amount : 0;

            if (options.autoRun && totalActivity >= 1750 && !isManual) {
                console.log('[HWH Dashboard] Background check: Activity already 1750+. Auto-closing silently.');
                return;
            }

            const activityGreen = !options.checkActivity || (totalActivity < 1750);
            const glyphGreen = !options.checkGlyph || (glyphAvailable === false);
            const refillGreen = !options.checkRefills || (boughtToday >= 2);
            const campaignEnergyGreen = !options.checkCampaignEnergy || (currentEnergy <= 120);
            const allMet = activityGreen && glyphGreen && refillGreen && campaignEnergyGreen;

            if (options.autoExec) {
                hasPopupOpenedThisSession = true; // Lock further auto-triggers
                
                // @AI-NOTE: Timezone Sync Check (Option B - Halt Entire Sequence)
                // @AI-NOTE: RU: Проверка синхронизации часовых поясов (Вариант B - Остановка всей последовательности)
                if (options.seqGlyphTimer && userInfo.nextDayTs) {
                    const now = Math.floor(Date.now() / 1000);
                    const H7 = 7 * 3600;
                    const H14 = 14 * 3600;
                    
                    const timeToAccountReset = userInfo.nextDayTs - now;
                    
                    const date = new Date();
                    let guildReset = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 2, 0, 0) / 1000;
                    if (now >= guildReset) guildReset += 24 * 3600;
                    const timeToGuildReset = guildReset - now;

                    const accUnder7 = timeToAccountReset < H7;
                    const guildUnder7 = timeToGuildReset < H7;
                    const accUnder14 = timeToAccountReset < H14;
                    const guildUnder14 = timeToGuildReset < H14;

                    if ((accUnder7 && !guildUnder14) || (guildUnder7 && !accUnder14)) {
                        console.warn('[HWH Dashboard] Auto-Exec halted: WAIT FOR RESET state detected (Account/Guild desync).');
                        setProgress(I18N('WAIT_SYNC'), 4000);
                        // @AI-NOTE: If you want Option A (skip only glyph), remove this 'return' and wrap only the 'seqGlyph' block below with this logic.
                        return; 
                    }
                }

                if (options.seqSpend && !campaignEnergyGreen && typeof unsafeWindow.HWH_CampAuto_API?.run === 'function') {
                    setProgress('Auto: ' + I18N('BTN_SPEND_ENERGY'), 2000);
                    unsafeWindow.HWH_CampAuto_API.run();
                    monitorEnergyAndRecheck(options);
                    return;
                }
                
                if (options.seqBuy && !refillGreen) {
                    setProgress('Auto: ' + I18N('BTN_FIX_REFILLS'), 2000);
                    performEnergyLoop().then(() => {
                        setProgress(I18N('WAIT_RECHECK'), 1000);
                        setTimeout(() => runChecks(options, true), 1000);
                    });
                    return;
                }
                
                if (options.seqGlyph && !glyphGreen) {
                    setProgress('Auto: ' + I18N('BTN_FIX_GLYPH'), 2000);
                    performGlyphFix().then(() => {
                        setProgress(I18N('WAIT_RECHECK'), 1000);
                        setTimeout(() => runChecks(options, true), 1000);
                    });
                    return;
                }
                
                if (options.seqExch && allMet && totalActivity < 1750) {
                    setProgress('Auto: ' + I18N('BTN_EXCHANGE'), 2000);
                    performItemExchange(1750 - totalActivity).then(() => {
                        setTimeout(() => runChecks(options, true), 1000);
                    });
                    return;
                }
            }

            setProgress([
                `Activity: ${totalActivity} / 1750`,
                `Glyph: ${glyphAvailable ? 'Available' : 'Done'}`,
                `50-Emerald Refills: ${boughtToday} / 2`,
                `Campaign Energy: ${currentEnergy}`
            ].join('<br>'), 4000);

            const contentHTML = `
                <div style="text-align: left; padding: 10px; font-size: 14px; color: #ddd;">
                    <h3 style="text-align: center; color: #fde5b6; margin-bottom: 15px;">${I18N('DASH_TITLE')}</h3>
                    <div style="margin-bottom: 8px;">${activityGreen ? '✅' : '❌'} <b>${I18N('LBL_ACT')}:</b> ${activityGreen ? I18N('STATUS_OK') : I18N('STATUS_NO')}</div>
                    <div style="margin-bottom: 8px;">${glyphGreen ? '✅' : '❌'} <b>${I18N('LBL_GLYPH')}:</b> ${glyphGreen ? I18N('STATUS_OK') : I18N('STATUS_NO')}</div>
                    <div style="margin-bottom: 8px;">${refillGreen ? '✅' : '❌'} <b>${I18N('LBL_REFILLS')}:</b> ${refillGreen ? I18N('STATUS_OK') : I18N('STATUS_NO')}</div>
                    <div style="margin-bottom: 15px;">${campaignEnergyGreen ? '✅' : '❌'} <b>${I18N('LBL_ENERGY')}:</b> ${campaignEnergyGreen ? I18N('STATUS_OK') : I18N('STATUS_NO')}</div>
                    <hr style="border-color: #555;">
                    <div style="text-align: center; font-weight: bold; font-size: 16px; margin-top: 15px; color: ${allMet ? '#88cb13' : '#ff9800'};">
                        ${allMet ? I18N('ALL_MET') : I18N('NOT_MET')}
                    </div>
                </div>
            `;

            const popupButtons =[];
            if (!glyphGreen) {
                popupButtons.push({ msg: I18N('BTN_FIX_GLYPH'), color: 'orange', result: async () => { await performGlyphFix(); setProgress(I18N('WAIT_RECHECK'), 1000); await delay(1000); runChecks(options, true); } });
            }
            if (!refillGreen) {
                popupButtons.push({ msg: I18N('BTN_FIX_REFILLS'), color: 'blue', result: async () => { await performEnergyLoop(); setProgress(I18N('WAIT_RECHECK'), 1000); await delay(1000); runChecks(options, true); } });
            }

            if (!campaignEnergyGreen && typeof unsafeWindow.HWH_CampAuto_API?.run === 'function') {
                popupButtons.push({
                    msg: I18N('BTN_SPEND_ENERGY'),
                    color: 'purple',
                    result: () => {
                        unsafeWindow.HWH_CampAuto_API.run();
                        monitorEnergyAndRecheck(options);
                    }
                });
            }

            if (allMet && totalActivity < 1750) {
                popupButtons.push({ msg: I18N('BTN_EXCHANGE'), color: 'pink', result: () => performItemExchange(1750 - totalActivity) });
            }

            popupButtons.push({ msg: 'OK', color: 'green', result: true });
            popupButtons.push({ result: false, isClose: true });

            // @AI-HIGHLIGHT: Mark the popup as opened so the auto-runner stops trying
            hasPopupOpenedThisSession = true;
            const answer = await popup.confirm(contentHTML, popupButtons);
            if (typeof answer === 'function') answer();
        }

        async function openDashboardPopup() {
            // @AI-HIGHLIGHT: Mark as opened if user manually clicks the menu button
            hasPopupOpenedThisSession = true;

            const userId = await getUserId();
            const allSettings = await extDB.get(userId, {});
            const dbOpts = allSettings.dailyDashboard || null;

            const opt = {
                act: dbOpts?.act ?? GM_getValue('db_act', true),
                gly: dbOpts?.gly ?? GM_getValue('db_gly', true),
                ref: dbOpts?.ref ?? GM_getValue('db_ref', true),
                nrg: dbOpts?.nrg ?? GM_getValue('db_nrg', true),
                autoDash: dbOpts?.autoDash ?? GM_getValue('db_auto_dash', false),
                autoExec: dbOpts?.autoExec ?? GM_getValue('db_auto_exec', false),
                seqSpend: dbOpts?.seqSpend ?? GM_getValue('db_seq_spend', true),
                seqBuy: dbOpts?.seqBuy ?? GM_getValue('db_seq_buy', false),
                seqGlyph: dbOpts?.seqGlyph ?? GM_getValue('db_seq_glyph', false),
                seqGlyphTimer: dbOpts?.seqGlyphTimer ?? GM_getValue('db_seq_glyph_timer', true),
                seqExch: dbOpts?.seqExch ?? GM_getValue('db_seq_exch', false)
            };

            const contentHTML = `
                <div style="text-align: left; padding: 10px; font-size: 14px; color: #ddd;">
                    <h3 style="text-align: center; color: #fde5b6; margin-bottom: 15px;">${I18N('DASH_TITLE')}</h3>
                    <div style="margin-bottom: 10px;"><input type="checkbox" id="db_act" ${opt.act ? 'checked' : ''}> <label for="db_act">${I18N('LBL_ACT')}</label></div>
                    <div style="margin-bottom: 10px;"><input type="checkbox" id="db_gly" ${opt.gly ? 'checked' : ''}> <label for="db_gly">${I18N('LBL_GLYPH')}</label></div>
                    <div style="margin-bottom: 10px;"><input type="checkbox" id="db_ref" ${opt.ref ? 'checked' : ''}> <label for="db_ref">${I18N('LBL_REFILLS')}</label></div>
                    <div style="margin-bottom: 10px;"><input type="checkbox" id="db_nrg" ${opt.nrg ? 'checked' : ''}> <label for="db_nrg">${I18N('LBL_ENERGY')}</label></div>
                    <hr style="border-color: #555;">
                    <div style="margin-bottom: 10px;"><input type="checkbox" id="db_auto_dash" ${opt.autoDash ? 'checked' : ''}> <label for="db_auto_dash"><b>${I18N('LBL_AUTO_DASH')}</b></label></div>
                    <div style="margin-bottom: 10px;"><input type="checkbox" id="db_auto_exec" ${opt.autoExec ? 'checked' : ''}> <label for="db_auto_exec"><b>${I18N('LBL_AUTO_EXEC')}</b></label></div>
                    <hr style="border-color: #555;">
                    <div style="text-align: center; color: #fde5b6; margin-bottom: 10px;"><b>${I18N('SEQ_TITLE')}</b></div>
                    <div style="margin-bottom: 5px;"><input type="checkbox" id="db_seq_spend" ${opt.seqSpend ? 'checked' : ''}> <label for="db_seq_spend">${I18N('SEQ_SPEND')}</label></div>
                    <div style="margin-bottom: 5px;"><input type="checkbox" id="db_seq_buy" ${opt.seqBuy ? 'checked' : ''}> <label for="db_seq_buy">${I18N('SEQ_BUY')}</label></div>
                    <div style="margin-bottom: 5px;"><input type="checkbox" id="db_seq_glyph" ${opt.seqGlyph ? 'checked' : ''}> <label for="db_seq_glyph">${I18N('SEQ_GLYPH')}</label></div>
                    <div style="margin-bottom: 5px; margin-left: 20px;"><input type="checkbox" id="db_seq_glyph_timer" ${opt.seqGlyphTimer ? 'checked' : ''}> <label for="db_seq_glyph_timer" style="color: #bbb; font-size: 13px;">${I18N('SEQ_GLYPH_TIMER')}</label></div>
                    <div style="margin-bottom: 15px;"><input type="checkbox" id="db_seq_exch" ${opt.seqExch ? 'checked' : ''}> <label for="db_seq_exch">${I18N('SEQ_EXCH')}</label></div>
                    
                    <div style="display: flex; gap: 5px; margin-top: 15px;">
                        <div onclick="HWH_Dashboard_API.run()" class="PopUp_btnGap green" style="flex: 1; cursor: pointer; padding: 3px;"><div class="PopUp_btnPlate" style="font-weight: bold; padding: 5px 0;">${I18N('BTN_RUN')}</div></div>
                        <div onclick="HWH_Dashboard_API.save()" class="PopUp_btnGap blue" style="flex: 1; cursor: pointer; padding: 3px;"><div class="PopUp_btnPlate" style="font-weight: bold; padding: 5px 0;">${I18N('BTN_SAVE_ACC')}</div></div>
                    </div>
                    <div style="display: flex; gap: 5px; margin-top: 5px;">
                        <div onclick="HWH_Dashboard_API.setDefault()" class="PopUp_btnGap violet" style="flex: 1; cursor: pointer; padding: 3px;"><div class="PopUp_btnPlate" style="font-weight: bold; padding: 5px 0; font-size: 12px;">${I18N('BTN_SET_DEFAULT')}</div></div>
                        <div onclick="HWH_Dashboard_API.loadDefault()" class="PopUp_btnGap red" style="flex: 1; cursor: pointer; padding: 3px;"><div class="PopUp_btnPlate" style="font-weight: bold; padding: 5px 0; font-size: 12px;">${I18N('BTN_LOAD_DEF')}</div></div>
                    </div>
                </div>
            `;

            const answer = await popup.confirm(contentHTML,[
                { result: false, isClose: true }
            ]);
            if (typeof answer === 'function') answer();
        }

        // 1. Store the original configuration of the Quest button
        if (!originalQuestConfig) {
            originalQuestConfig = { ...HWHData.buttons.dailyQuests };
        }

        // 2. Load saved state using GM_getValue
        let isButtonEnabled = GM_getValue('hwh_custom_quest_btn_enabled', true);

        const syncQuestButton = () => {
            if (isButtonEnabled) {
                const customSideButton = {
                    get name() { return "1750"; },
                    get title() { return I18N('DASH_TITLE'); },
                    onClick: openDashboardPopup,
                    color: 'blue'
                };

                HWHData.buttons.dailyQuests = {
                    isCombine: true,
                    combineList:[
                        originalQuestConfig,
                        customSideButton
                    ]
                };
            } else {
                HWHData.buttons.dailyQuests = originalQuestConfig;
            }
        };

        syncQuestButton();

        HWHData.othersPopupButtons.push({
            msg: I18N('QUEST_SETTINGS'),
            title: I18N('QUEST_CONFIG'),
            color: 'violet',
            result: async function () {
                const { popup } = HWHFuncs;
                const contentHTML = `<div style="text-align: center; font-size: 14px; color: #fde5b6;">${I18N('QUEST_CONFIG')}</div>`;
                const popupCheckboxes =[{ name: 'toggle_btn', label: I18N('LBL_SHOW_BTN'), checked: isButtonEnabled }];
                const popupButtons =[{ msg: 'Save / Сохранить', result: true, color: 'green' }, { result: false, isClose: true }];
                const answer = await popup.confirm(contentHTML, popupButtons, popupCheckboxes);

                if (answer) {
                    const newState = popup.getCheckBoxes().find(c => c.name === 'toggle_btn').checked;
                    isButtonEnabled = newState;
                    GM_setValue('hwh_custom_quest_btn_enabled', newState);
                    syncQuestButton();
                    HWHFuncs.setProgress("Settings Saved / Настройки сохранены", true);
                }
            }
        });

        othersPopupButtons.push({
            msg: 'Daily Dashboard / Ежедневная панель',
            title: 'Auto-run, Energy Loop, and Item Exchange.',
            result: openDashboardPopup,
            color: 'blue',
        });

        // @AI-HIGHLIGHT: New Auto-Run Logic (5s initial delay + 5 retries every 2s)
        let autoRunAttempts = 0;
        let autoRunInterval = null;

        const executeAutoCheckTick = async () => {
            // Stop if the popup was already opened by the user or a previous tick
            if (hasPopupOpenedThisSession) {
                if (autoRunInterval) clearInterval(autoRunInterval);
                return;
            }

            const userId = await getUserId();
            const allSettings = await extDB.get(userId, {});
            const dbOpts = allSettings.dailyDashboard || null;
            
            const opt = {
                act: dbOpts?.act ?? GM_getValue('db_act', true),
                gly: dbOpts?.gly ?? GM_getValue('db_gly', true),
                ref: dbOpts?.ref ?? GM_getValue('db_ref', true),
                nrg: dbOpts?.nrg ?? GM_getValue('db_nrg', true),
                autoDash: dbOpts?.autoDash ?? GM_getValue('db_auto_dash', false),
                autoExec: dbOpts?.autoExec ?? GM_getValue('db_auto_exec', false),
                seqSpend: dbOpts?.seqSpend ?? GM_getValue('db_seq_spend', true),
                seqBuy: dbOpts?.seqBuy ?? GM_getValue('db_seq_buy', false),
                seqGlyph: dbOpts?.seqGlyph ?? GM_getValue('db_seq_glyph', false),
                seqGlyphTimer: dbOpts?.seqGlyphTimer ?? GM_getValue('db_seq_glyph_timer', true),
                seqExch: dbOpts?.seqExch ?? GM_getValue('db_seq_exch', false)
            };

            if (!opt.autoDash) {
                if (autoRunInterval) clearInterval(autoRunInterval);
                return;
            }

            try {
                const quests = await Caller.send('questGetAll');
                const activityQuest = quests.find(q => q.id >= 10047 && q.id <= 10050);
                const totalActivity = activityQuest ? activityQuest.progress : 1750;

                // Stop if activity is already completed
                if (totalActivity >= 1750) {
                    console.log('[HWH Dashboard] Auto-run: Activity 1750+. Stopping retry sequence.');
                    if (autoRunInterval) clearInterval(autoRunInterval);
                    return;
                }

                console.log(`[HWH Dashboard] Auto-run attempt ${autoRunAttempts + 1} firing...`);

                // Lock immediately to prevent the next interval from firing while API is resolving
                hasPopupOpenedThisSession = true;
                if (autoRunInterval) clearInterval(autoRunInterval);

                runChecks({
                    checkActivity: opt.act,
                    checkGlyph: opt.gly,
                    checkRefills: opt.ref,
                    checkCampaignEnergy: opt.nrg,
                    autoRun: opt.autoDash,
                    autoExec: opt.autoExec,
                    seqSpend: opt.seqSpend,
                    seqBuy: opt.seqBuy,
                    seqGlyph: opt.seqGlyph,
                    seqGlyphTimer: opt.seqGlyphTimer,
                    seqExch: opt.seqExch
                }, false);

            } catch (err) {
                console.warn(`[HWH Dashboard] Auto-run attempt ${autoRunAttempts + 1} failed (API not ready). Retrying...`);
            }
        };

        // Start the sequence 5 seconds after initialization
        setTimeout(() => {
            executeAutoCheckTick(); // 1st attempt

            autoRunInterval = setInterval(() => {
                autoRunAttempts++;
                if (autoRunAttempts >= 5) {
                    clearInterval(autoRunInterval); // Stop after 5 additional attempts
                }
                executeAutoCheckTick();
            }, 2000); // 2 seconds between retries

        }, 5000);
    }
})();
