// ==UserScript==
// @name             HWH Daily Dashboard
// @name:en          HWH Daily Dashboard
// @name:ru          HWH Ежедневная панель
// @namespace        HWH_DailyDashboard
// @version          1.12.0
// @description      Ultimate daily dashboard: Auto-run, Smart Energy Loop, Item Exchange, and Forensic Activity Check with Retry Loop.
// @author           HWH Extension Architect
// @match            https://www.hero-wars.com/*
// @match            https://apps-1701433570146040.apps.fbsbx.com/*
// @grant            unsafeWindow
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

        console.log('%c[HWH Daily Dashboard] Script initialized (v1.12.0).', 'color: #00bcd4; font-weight: bold;');

        // @AI-HIGHLIGHT: Session variable to track if the popup has been opened at least once since page load (F5 resets this)
        let hasPopupOpenedThisSession = false;

        // --- @SECTION: I18N DATA ---
        const i18nData = {
            en: {
                DASH_TITLE: 'Daily Dashboard',
                DASH_DESC: 'Select conditions to validate for item exchange.',
                LBL_ACT: 'Activity < 1750',
                LBL_GLYPH: 'Glyph Enchanted',
                LBL_REFILLS: 'Energy Refills (50)',
                LBL_ENERGY: 'Campaign Energy <= 120',
                LBL_AUTO: 'Auto Run + Auto-Close',
                LBL_SHOW_BTN: 'Show "1750" Button',
                BTN_RUN: 'Run Pre-Check',
                BTN_FIX_GLYPH: 'Enchant Glyph',
                BTN_FIX_REFILLS: 'Buy Energy (Loop)',
                BTN_SPEND_ENERGY: 'Spend Energy (Monitor)',
                BTN_EXCHANGE: 'Item Exchange',
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
                QUEST_CONFIG: 'Dashboard Button Configuration'
            },
            ru: {
                DASH_TITLE: 'Ежедневная панель',
                DASH_DESC: 'Выберите условия для проверки обмена предметов.',
                LBL_ACT: 'Активность < 1750',
                LBL_GLYPH: 'Глиф зачарован',
                LBL_REFILLS: 'Покупки энергии (50)',
                LBL_ENERGY: 'Энергия кампании <= 120',
                LBL_AUTO: 'Автозапуск + Автозакрытие',
                LBL_SHOW_BTN: 'Показать кнопку "1750"',
                BTN_RUN: 'Запустить проверку',
                BTN_FIX_GLYPH: 'Зачаровать глиф',
                BTN_FIX_REFILLS: 'Купить энергию (Цикл)',
                BTN_SPEND_ENERGY: 'Потратить энергию (Монитор)',
                BTN_EXCHANGE: 'Обмен предметов',
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
                QUEST_CONFIG: 'Конфигурация кнопки панели'
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
                    args: { items: { [activeItem.type]: { [activeItem.id]: countToExchange } } }
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
            const [heroes, inventory] = await Caller.send(['heroGetAll', 'inventoryGet']);
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

            const opt = {
                act: getSaveVal('db_act', true),
                gly: getSaveVal('db_gly', true),
                ref: getSaveVal('db_ref', true),
                nrg: getSaveVal('db_nrg', true),
                auto: getSaveVal('db_auto', true)
            };

            const contentHTML = `
                <div style="text-align: left; padding: 10px; font-size: 14px; color: #ddd;">
                    <h3 style="text-align: center; color: #fde5b6; margin-bottom: 15px;">${I18N('DASH_TITLE')}</h3>
                    <div style="margin-bottom: 10px;"><input type="checkbox" id="db_act" ${opt.act ? 'checked' : ''}> <label for="db_act">${I18N('LBL_ACT')}</label></div>
                    <div style="margin-bottom: 10px;"><input type="checkbox" id="db_gly" ${opt.gly ? 'checked' : ''}> <label for="db_gly">${I18N('LBL_GLYPH')}</label></div>
                    <div style="margin-bottom: 10px;"><input type="checkbox" id="db_ref" ${opt.ref ? 'checked' : ''}> <label for="db_ref">${I18N('LBL_REFILLS')}</label></div>
                    <div style="margin-bottom: 10px;"><input type="checkbox" id="db_nrg" ${opt.nrg ? 'checked' : ''}> <label for="db_nrg">${I18N('LBL_ENERGY')}</label></div>
                    <hr style="border-color: #555;">
                    <div style="margin-bottom: 10px;"><input type="checkbox" id="db_auto" ${opt.auto ? 'checked' : ''}> <label for="db_auto"><b>${I18N('LBL_AUTO')}</b></label></div>
                </div>
            `;

            const answer = await popup.confirm(contentHTML,[
                {
                    msg: I18N('BTN_RUN'), color: 'green',
                    result: () => {
                        const newOpt = {
                            checkActivity: document.getElementById('db_act').checked,
                            checkGlyph: document.getElementById('db_gly').checked,
                            checkRefills: document.getElementById('db_ref').checked,
                            checkCampaignEnergy: document.getElementById('db_nrg').checked,
                            autoRun: document.getElementById('db_auto').checked
                        };
                        setSaveVal('db_act', newOpt.checkActivity);
                        setSaveVal('db_gly', newOpt.checkGlyph);
                        setSaveVal('db_ref', newOpt.checkRefills);
                        setSaveVal('db_nrg', newOpt.checkCampaignEnergy);
                        setSaveVal('db_auto', newOpt.autoRun);
                        runChecks(newOpt, true);
                    }
                },
                { msg: 'Cancel', color: 'red', result: false },
                { result: false, isClose: true }
            ]);
            if (typeof answer === 'function') answer();
        }

        // 1. Store the original configuration of the Quest button
        if (!originalQuestConfig) {
            originalQuestConfig = { ...HWHData.buttons.dailyQuests };
        }

        // 2. Load saved state
        let isButtonEnabled = localStorage.getItem('hwh_custom_quest_btn_enabled') === 'true';

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
                    combineList: [
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
                    localStorage.setItem('hwh_custom_quest_btn_enabled', newState);
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
        if (getSaveVal('db_auto', true)) {
            let autoRunAttempts = 0;
            let autoRunInterval = null;

            const executeAutoCheckTick = async () => {
                // Stop if the popup was already opened by the user or a previous tick
                if (hasPopupOpenedThisSession) {
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
                        checkActivity: getSaveVal('db_act', true),
                        checkGlyph: getSaveVal('db_gly', true),
                        checkRefills: getSaveVal('db_ref', true),
                        checkCampaignEnergy: getSaveVal('db_nrg', true),
                        autoRun: true
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
    }
})();