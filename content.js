(function() {
  'use strict';

  // Global variables
  var alarmInterval = null;
  var monsterFiltersSettings = {"nameFilter":"","hideImg":false, "battleLimitAlarm":false, "battleLimitAlarmSound":true, "battleLimitAlarmVolume":70, "monsterTypeFilter":[], "hpFilter":"", "playerCountFilter":"", "waveFilter":""}
  var isMobileView = window.innerWidth <= 600;
  var resizeListener = null;

  // Mobile state detection listener
  window.addEventListener('resize', () => {
    isMobileView = window.innerWidth <= 600;
  });

  // Embedded encryption utilities
  class SecureCredentials {
    constructor() {
      this.storageKey = 'veyra_encryption_key';
      this.encryptionKey = this.getOrCreateKey();
    }
    
    getOrCreateKey() {
      let key = sessionStorage.getItem(this.storageKey);
      
      if (!key) {
        const fingerprint = btoa(
          navigator.userAgent + 
          navigator.platform + 
          navigator.language + 
          screen.width + 
          screen.height + 
          Date.now().toString().slice(0, 5)
        );
        
        let hash = 0;
        for (let i = 0; i < fingerprint.length; i++) {
          const char = fingerprint.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        key = Math.abs(hash).toString(36).substring(0, 16);
        sessionStorage.setItem(this.storageKey, key);
      }
      
      return key;
    }
    
    encrypt(data) {
      const key = this.encryptionKey;
      let result = '';
      for (let i = 0; i < data.length; i++) {
        result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return btoa(result);
    }
    
    decrypt(encryptedData) {
      const key = this.encryptionKey;
      const data = atob(encryptedData);
      let result = '';
      for (let i = 0; i < data.length; i++) {
        result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return result;
    }
    
    saveEmail(email) {
      if (email) {
        const encrypted = this.encrypt(email);
        sessionStorage.setItem('autologin-email', encrypted);
      }
    }
    
    savePassword(password) {
      if (password) {
        const encrypted = this.encrypt(password);
        sessionStorage.setItem('autologin-password', encrypted);
      }
    }
    
    getEmail() {
      const encrypted = sessionStorage.getItem('autologin-email');
      return encrypted ? this.decrypt(encrypted) : '';
    }
    
    getPassword() {
      const encrypted = sessionStorage.getItem('autologin-password');
      return encrypted ? this.decrypt(encrypted) : '';
    }
  }

  // Enhanced settings management
  var extensionSettings = {
    sidebarColor: '#1e1e2e',
    backgroundColor: '#000000',
    statAllocationCollapsed: true,
    statsExpanded: false,
    petsExpanded: false,
    blacksmithExpanded: false,
    continueBattlesExpanded: true,
    lootExpanded: true,
    merchantExpanded: false,
    inventoryExpanded: false,
    pinnedMerchantItems: [],
    pinnedInventoryItems: [],
    multiplePotsEnabled: false,
    multiplePotsCount: 3,
    pinnedItemsLimit: 3,
    automationExpanded: false,
    sidebarVisible: true,
    farmingMode: 'energy-cap',
    energyCap: 30,
    energyTarget: 150,
    autoSurrenderEnabled: false,
  };

  // Page-specific functionality mapping
  const extensionPageHandlers = {
    '/active_wave.php': initWaveMods,
    '/game_dash.php': initDashboardTools,
    '/battle.php': initBattleMods,
    '/chat.php': initChatMods,
    '/inventory.php': initInventoryMods,
    '/pets.php': initPetMods,
    '/stats.php': initStatMods,
    '/pvp.php': initPvPMods,
    '/pvp_battle.php': initPvPBattleMods,
    '/blacksmith.php': initBlacksmithMods,
    '/merchant.php': initMerchantMods,
    '/orc_cull_event.php': initEventMods,
  };

  // Automatic retrieval of userId from cookie
  function getCookieExtension(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  }

  const userId = getCookieExtension('demon');
  if(!userId){
    console.log('Not logged in')
  }

  function initDraggableFalse(){
    document.querySelectorAll('a').forEach(x => x.draggable = false);
    document.querySelectorAll('button').forEach(x => x.draggable = false);
  }

  // Settings management
  function loadSettings() {
    const saved = localStorage.getItem('demonGameExtensionSettings');
    if (saved) {
      extensionSettings = { ...extensionSettings, ...JSON.parse(saved) };
    }
    
    applySettings();
  }

  function saveSettings() {
    localStorage.setItem('demonGameExtensionSettings', JSON.stringify(extensionSettings));
  }

  function applySettings() {
    const sidebar = document.getElementById('game-sidebar');
    if (sidebar) {
      sidebar.style.background = extensionSettings.sidebarColor;
    }
    document.body.style.backgroundColor = extensionSettings.backgroundColor;
  }

  // Function to update sidebar stats
  function updateSidebarStats(userStats) {
    // Update stats in the menu item
    const sidebarAttack = document.getElementById('sidebar-attack');
    const sidebarDefense = document.getElementById('sidebar-defense');
    const sidebarStamina = document.getElementById('sidebar-stamina');
    const sidebarPoints = document.getElementById('sidebar-points');

    // Allocation section elements
    const sidebarAttackAlloc = document.getElementById('sidebar-attack-alloc');
    const sidebarDefenseAlloc = document.getElementById('sidebar-defense-alloc');
    const sidebarStaminaAlloc = document.getElementById('sidebar-stamina-alloc');
    const sidebarPointsAlloc = document.getElementById('sidebar-points-alloc');

    // Update menu item stats
    if (sidebarAttack) sidebarAttack.textContent = userStats.ATTACK;
    if (sidebarDefense) sidebarDefense.textContent = userStats.DEFENSE;
    if (sidebarStamina) sidebarStamina.textContent = userStats.STAMINA;
    if (sidebarPoints) sidebarPoints.textContent = userStats.STAT_POINTS;

    // Update allocation section
    if (sidebarAttackAlloc) sidebarAttackAlloc.textContent = userStats.ATTACK;
    if (sidebarDefenseAlloc) sidebarDefenseAlloc.textContent = userStats.DEFENSE;
    if (sidebarStaminaAlloc) sidebarStaminaAlloc.textContent = userStats.STAMINA;
    if (sidebarPointsAlloc) sidebarPointsAlloc.textContent = userStats.STAT_POINTS;
  }

  async function savePlayerState(params) {
    const attack = document.getElementById('v-attack')?.textContent || params?.attack;
    const defense = document.getElementById('v-defense')?.textContent || params?.defense;
    const stamina = document.getElementById('v-stamina')?.textContent || params?.stamina;
    const points = document.getElementById('v-points')?.textContent || params?.points;
    const levelEl = document.querySelector('.gtb-level');
    const level = levelEl ? parseInt(levelEl.textContent.replace(/\D/g, '')) : 0;

    if (attack && defense && stamina && points) {
      const playerState = {
        attack: parseInt(attack.replace(/,/g, '')),
        defense: parseInt(defense.replace(/,/g, '')),
        stamina: parseInt(stamina.replace(/,/g, '')),
        points: parseInt(points.replace(/,/g, '')),
        level: level,
        timestamp: Date.now()
      };
      localStorage.setItem('playerState', JSON.stringify(playerState));
    }
  }

  async function getPlayerState() {
    try {
      const saved = localStorage.getItem('playerState');
      if (!saved) return null;

      const playerState = JSON.parse(saved);
      const currentLevelEl = document.querySelector('.gtb-level');
      const currentLevel = currentLevelEl ? parseInt(currentLevelEl.textContent.replace(/\D/g, '')) : playerState.level;

      // Calculate level difference and adjust unallocated points
      const levelDiff = currentLevel - playerState.level;
      const additionalPoints = levelDiff * 5;

      return {
        attack: playerState.attack,
        defense: playerState.defense,
        stamina: playerState.stamina,
        points: playerState.points + additionalPoints,
        level: currentLevel,
        askToFetch: additionalPoints > 0 ? true : false
      };
    } catch {
      return null;
    }
  }

  // Function to fetch current stats and update sidebar
  async function fetchAndUpdateSidebarStats() {
    try {
      // Try to get stats from savedState first, then page elements, then make AJAX call
      let attack = '-', defense = '-', stamina = '-', points = '-';

      // Method 1: Try stats from savedState (attack, etc.)
      const savedState = getPlayerState();
      if (savedState && !savedState.askToFetch) {
        updateSidebarStats({
          ATTACK: savedState.attack,
          DEFENSE: savedState.defense,
          STAMINA: savedState.stamina,
          STAT_POINTS: savedState.points
        });
        return;
      }

      // Method 2: Try stats page elements (v-attack, etc.)
      attack = document.getElementById('v-attack')?.textContent || 
              document.querySelector('[data-stat="attack"]')?.textContent;
      defense = document.getElementById('v-defense')?.textContent || 
               document.querySelector('[data-stat="defense"]')?.textContent;
      stamina = document.getElementById('v-stamina')?.textContent || 
               document.querySelector('[data-stat="stamina"]')?.textContent;
      points = document.getElementById('v-points')?.textContent || 
              document.querySelector('[data-stat="points"]')?.textContent;

      // Method 3: Try topbar stamina (but we'll need AJAX for attack/defense/points)
      if (!stamina || stamina === '-') {
        const staminaSpan = document.getElementById('stamina_span');
        if (staminaSpan) {
          const staminaText = staminaSpan.textContent;
          const staminaMatch = staminaText.match(/(\d+)/);
          if (staminaMatch) {
            stamina = staminaMatch[1];
          }
        }
      }

      // Method 3: If we don't have attack/defense/points, try AJAX call with different approaches
      if ((!attack || attack === '-') || (!defense || defense === '-') || (!points || points === '-')) {
        try {
          let result, type
          // Try the allocate action first (it returns current stats)
          await fetch('stats_ajax.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'action=get_stats'
          }).then(async response => {
            result = response.ok ? await response.text() : null
            type = 'json'
          });
          
          if (!result) {
            // Try alternative approach - stupid strick
            await fetch('stats.php', {
              method: 'GET',
            }).then(async response => {
              const htmlPage = document.createElement('html')
              htmlPage.innerHTML = await response.text();
              result = htmlPage.querySelector('.container');
              type = 'html'
            });
          }
          
          if (result) {
            try {
              if(type === 'json') {
                const data = JSON.parse(result);
                if (data && data.user) {
                  attack = data.user.ATTACK || data.user.attack || attack || '-';
                  defense = data.user.DEFENSE || data.user.defense || defense || '-';
                  stamina = data.user.STAMINA || data.user.MAX_STAMINA || data.user.stamina || stamina || '-';
                  points = data.user.STAT_POINTS || data.user.stat_points || points || '-';
                  console.log('Parsed stats:', { attack, defense, stamina, points });
                }
              } else if (type === 'html') {
                attack = result.querySelector('#v-attack')?.textContent || attack || '-';
                defense = result.querySelector('#v-defense')?.textContent || defense || '-';
                stamina = result.querySelector('#v-stamina')?.textContent || stamina || '-';
                points = result.querySelector('#v-points')?.textContent || points || '-';
                console.log('Parsed stats:', { attack, defense, stamina, points });
              }
              savePlayerState({attack,defense,stamina,points})
            } catch (parseError) {
              console.log('JSON parse error:', parseError, 'Response was:', text);
            }
          }
        } catch (ajaxError) {
          console.log('AJAX stats fetch failed:', ajaxError);
        }
      }

      updateSidebarStats({
        ATTACK: attack || '-',
        DEFENSE: defense || '-',
        STAMINA: stamina || '-',
        STAT_POINTS: points || '-'
      });
    } catch (error) {
      console.log('Could not fetch stats:', error);
      updateSidebarStats({
        ATTACK: '-',
        DEFENSE: '-',
        STAMINA: '-',
        STAT_POINTS: '-'
      });
    }
  }

  function initSideBar(){
    const noContainerPage = !document.querySelector('.container') && !document.querySelector('.wrap');
    const mainWrapper = document.createElement('div');
    mainWrapper.className = 'main-wrapper';

    const sidebar = document.createElement('aside');
    sidebar.id = 'game-sidebar';
    sidebar.innerHTML = `
      <div class="sidebar-header">
        <a href="game_dash.php" style="text-decoration:none;"><h2>Game Menu</h2></a>
      </div>

      <ul class="sidebar-menu">
        <li><a href="pvp.php"><img src="/images/pvp/season_1/compressed_menu_pvp_season_1.webp" alt="PvP Arena"> PvP Arena</a></li>
        <li><a href="orc_cull_event.php"><img src="/images/events/orc_cull/banner.webp" alt="Goblin Feast"> 🪓 ⚔️ War Drums of GRAKTHAR</a></li>
        <li><a href="active_wave.php?event=2&wave=6" draggable="false"><img src="/images/events/orc_cull/banner.webp" alt="War Drums of GRAKTHAR"> Event Battlefield</a></li>
        <li><a href="active_wave.php?gate=3&wave=3"><img src="images/gates/gate_688e438aba7f24.99262397.webp" alt="Gate"> Gate Grakthar</a></li>
        <li><a href="inventory.php"><img src="images/menu/compressed_chest.webp" alt="Inventory"> Inventory & Equipment</a></li>
        <li>
          <div class="sidebar-menu-expandable">
            <a href="pets.php"><img src="images/menu/compressed_eggs_menu.webp" alt="Pets"> Pets & Eggs</a>
            <button class="expand-btn" id="pets-expand-btn">+</button>
          </div>
          <div id="pets-expanded" class="sidebar-submenu collapsed">
            <div class="coming-soon-text">🚧 Working on it / Coming Soon</div>
          </div>
        </li>
        <li>
          <div class="sidebar-menu-expandable">
            <a href="stats.php" draggable="false">
              <img src="images/menu/compressed_stats_menu.webp" alt="Stats"> 
              <span id="stats-menu-text">Stats ⚔️<span id="sidebar-attack">-</span> 🛡️<span id="sidebar-defense">-</span> ⚡<span id="sidebar-stamina">-</span> 🔵<span id="sidebar-points">-</span></span>
            </a>
            <button class="expand-btn" id="stats-expand-btn" draggable="false">${extensionSettings.statsExpanded ? '–' : '+'}</button>
          </div>
          <div id="stats-expanded" class="sidebar-submenu ${extensionSettings.statsExpanded ? '' : 'collapsed'}">
            <div class="stats-allocation-section">
              <div class="upgrade-section">
                <div class="stat-upgrade-row" data-stat="attack">
                  <div class="stat-info">
                    <span>⚔️ Atk</span>
                    <span id="sidebar-attack-alloc" style="margin-right:6px;">-</span>
                  </div>
                  <div class="upgrade-controls">
                    <button class="upgrade-btn" draggable="false">+1</button>
                    <button class="upgrade-btn" draggable="false">+5</button>
                  </div>
                </div>
                <div class="stat-upgrade-row" data-stat="defense">
                  <div class="stat-info">
                    <span>🛡️ Def</span>
                    <span id="sidebar-defense-alloc" style="margin-right:6px;">-</span>
                  </div>
                  <div class="upgrade-controls">
                    <button class="upgrade-btn" draggable="false">+1</button>
                    <button class="upgrade-btn" draggable="false">+5</button>
                  </div>
                </div>
                <div class="stat-upgrade-row" data-stat="stamina">
                  <div class="stat-info">
                    <span>⚡ Sta</span>
                    <span id="sidebar-stamina-alloc" style="margin-right:6px;">-</span>
                  </div>
                  <div class="upgrade-controls">
                    <button class="upgrade-btn" draggable="false">+1</button>
                    <button class="upgrade-btn" draggable="false">+5</button>
                  </div>
                </div>
                <div class="upgrade-note">Points Available: <span id="sidebar-points-alloc">-</span></div>
              </div>
            </div>
          </div>
        </li>
        <li>
          <div class="sidebar-menu-expandable">
            <a href="blacksmith.php"><img src="images/menu/compressed_crafting.webp" alt="Blacksmith"> Blacksmith</a>
            <button class="expand-btn" id="blacksmith-expand-btn">+</button>
          </div>
          <div id="blacksmith-expanded" class="sidebar-submenu collapsed">
            <div class="coming-soon-text">🚧 Working on it / Coming Soon</div>
          </div>
        </li>
        <li>
          <div class="sidebar-menu-expandable">
            <a href="merchant.php"><img src="images/menu/compressed_merchant.webp" alt="Merchant"> Merchant</a>
            <button class="expand-btn" id="merchant-expand-btn">${extensionSettings.merchantExpanded ? '–' : '+'}</button>
          </div>
          <div id="merchant-expanded" class="sidebar-submenu ${extensionSettings.merchantExpanded ? '' : 'collapsed'}">
            <div class="coming-soon-text">Visit merchant page to pin items for quick access</div>
          </div>
        </li>
        <li>
          <div class="sidebar-menu-expandable">
            <a href="inventory.php"><img src="images/menu/compressed_chest.webp" alt="Inventory"> Inventory Quick Access</a>
            <button class="expand-btn" id="inventory-expand-btn">${extensionSettings.inventoryExpanded ? '–' : '+'}</button>
          </div>
          <div id="inventory-expanded" class="sidebar-submenu ${extensionSettings.inventoryExpanded ? '' : 'collapsed'}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <span style="font-size: 12px; color: #888;">Pinned Items</span>
              <button id="refresh-inventory-btn" style="background: #74c0fc; color: #1e1e2e; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 10px;">🔄</button>
            </div>
            <div class="sidebar-quick-access">
              <div class="quick-access-empty">No items pinned. Visit inventory page to pin items.</div>
            </div>
          </div>
        </li>
        <li><a href="achievements.php"><img src="images/menu/compressed_achievments.webp" alt="Achievements"> Achievements</a></li>
        <li><a href="collections.php"><img src="images/menu/compressed_collections.webp" alt="Collections"> Collections</a></li>
        <li><a href="guide.php"><img src="images/menu/compressed_guide.webp" alt="Guide"> How To Play</a></li>
        <li><a href="weekly.php"><img src="images/menu/weekly_leaderboard.webp" alt="Leaderboard"> Weekly Leaderboard</a></li>
        <li><a href="chat.php"><img src="images/menu/compressed_chat.webp" alt="Chat"> Global Chat</a></li>
        <li><a href="patches.php"><img src="images/menu/compressed_patches.webp" alt="PatchNotes"> Patch Notes</a></li>
        <li><a href="index.php"><img src="images/menu/compressed_manga.webp" alt="Manga"> Manga-Manhwa-Manhua</a></li>
        <li>
          <div class="sidebar-menu-expandable">
            <a href="#"><img src="https://i.ibb.co.com/TD4SQmRb/1758653168.jpg" alt="Inventory"> Automation Script</a>
            <button class="expand-btn" id="automation-expand-btn">${extensionSettings.automationExpanded ? '–' : '+'}</button>
          </div>
          <div id="automation-expanded" class="sidebar-submenu ${extensionSettings.automationExpanded ? '' : 'collapsed'}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <span style="font-size: 12px; color: #888;">PvP Automation</span>
              <button id="btn-automation-pvp" style="background: #74c0fc; color: #1e1e2e; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 10px;">🤖 PvP Auto</button>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <span style="font-size: 12px; color: #888;">Energy Autofarm</span>
              <button id="btn-automation-farming" style="background: #74c0fc; color: #1e1e2e; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 10px;">🌽 Auto Farm Energy</button>
            </div>
          </div>
        </li>
        <li><a href="#" id="settings-link"><img src="images/menu/compressed_stats_menu.webp" alt="Settings"> ⚙️ Settings</a></li>
      </ul>
    `;

    const sidebarClose = document.createElement('div')
    sidebarClose.className = 'sidebar-toggle-x';
    sidebarClose.innerText = 'X';
    sidebar.querySelector('.sidebar-header').appendChild(sidebarClose)

    const sidebarToggle = document.createElement('div')
    sidebarToggle.className = 'sidebar-toggle hide';
    sidebarToggle.innerText = 'Game Menu';

    const contentArea = document.createElement('div');
    contentArea.className = 'content-area';
    if(noContainerPage){
      const topbar = document.querySelector('.game-topbar');
      const allElements = Array.from(document.body.children);
      const topbarIndex = allElements.indexOf(topbar);

      for (let i = topbarIndex + 1; i < allElements.length; i++) {
        if (!allElements[i].classList.contains('main-wrapper') &&
            !allElements[i].id !== 'sidebarToggle') {
          contentArea.appendChild(allElements[i]);
        }
      }
    } else {
      const existingContainer = document.querySelector('.container') || document.querySelector('.wrap');
      if (existingContainer) {
        contentArea.appendChild(existingContainer);
      }
    }

    mainWrapper.appendChild(sidebar);
    mainWrapper.appendChild(sidebarToggle);
    mainWrapper.appendChild(contentArea);
    document.body.appendChild(mainWrapper);

    sidebarToggle.addEventListener('click', () => {
      if(sidebar.classList.contains('hide')){
        sidebar.classList.remove('hide')
        if(!isMobileView) contentArea.classList.remove('full')
        sidebarToggle.classList.add('hide')
        extensionSettings.sidebarVisible = true;
      } else {
        sidebar.classList.add('hide')
        if(!isMobileView && !contentArea.classList.contains('full')) contentArea.classList.add('full')
        sidebarToggle.classList.remove('hide')
        extensionSettings.sidebarVisible = false;
      }
      saveSettings();
    });

    sidebarClose.addEventListener('click', () => {
      if(sidebar.classList.contains('hide')){
        sidebar.classList.remove('hide')
        if(!isMobileView) contentArea.classList.remove('full')
        sidebarToggle.classList.add('hide')
        extensionSettings.sidebarVisible = true;
      } else {
        sidebar.classList.add('hide')
        if(!isMobileView && !contentArea.classList.contains('full')) contentArea.classList.add('full')
        sidebarToggle.classList.remove('hide')
        extensionSettings.sidebarVisible = false;
      }
      saveSettings();
    });

    // Apply saved sidebar visibility state
    if (!extensionSettings.sidebarVisible || isMobileView) {
      sidebar.classList.add('hide');
      contentArea.classList.add('full');
      sidebarToggle.classList.remove('hide');
    }

    document.body.style.paddingTop = !isMobileView ? "55px" : "80px";
    document.body.style.paddingLeft = "0px";
    document.body.style.margin = "0px";

    const style = document.createElement('style');
    style.textContent = `
      .main-wrapper {
        display: flex;
        min-height: calc(100vh - 74px);
      }

      #game-sidebar {
        width: 250px;
        background: ${extensionSettings.sidebarColor};
        border-right: 1px solid rgba(255, 255, 255, 0.06);
        flex-shrink: 0;
        padding: 15px 0;
        overflow-y: auto;
        position: fixed;
        height: calc(100% - 100px);
        top: 76px;
        transition: all .5s ease;
        left: 0;
        z-index: 100;
      }

      .content-area.full .panel .event-table td:has(a.btn) {
        padding: 10px 0;
      }

      #game-sidebar::-webkit-scrollbar, .settings-content::-webkit-scrollbar {
        background-color: rgba(255,255,255,0);
        width:10px;
      }

      #game-sidebar::-webkit-scrollbar-track, .settings-content::-webkit-scrollbar-track {
        background-color: rgba(0,0,0,0);
      }

      #game-sidebar::-webkit-scrollbar-thumb, .settings-content::-webkit-scrollbar-thumb {
        background-color: #555;
        border-radius:16px;
        border: 1px solid rgba(255,255,255,0);
      }

      #game-sidebar.hide {
        left:-252px;
        z-index: -1;
      }

      .sidebar-header {
        padding: 0 20px 15px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        margin-bottom: 15px;
      }

      .sidebar-header h2 {
        color: #FFD369;
        margin: 0;
        font-size: 1.4rem;
      }

      .sidebar-section {
        margin: 0 20px 20px 20px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        overflow: hidden;
      }

      .sidebar-toggle {
        cursor: pointer;
        background: ${extensionSettings.sidebarColor};
        position: fixed;
        left: -46px;
        bottom: 60px;
        transform: rotate(90deg);
        padding: 10px 20px;
        border-radius: 14px 14px 0 0;
      }

      .sidebar-toggle.hide {
        z-index: -1;
      }

      .sidebar-toggle-x {
        position: absolute;
        right: 4px;
        top: 16px;
        padding: 4px;
        cursor: pointer;
        color: #FFD369;
      }

      .stats-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 15px;
        cursor: pointer;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }

      .stats-header:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .stats-basic {
        flex: 1;
      }

      .stats-title {
        display: block;
        color: #FFD369;
        font-weight: bold;
        margin-bottom: 8px;
        font-size: 14px;
      }

      .stats-inline {
        display: flex;
        gap: 10px;
        font-size: 10px; /* Stats text size */
        color: #e0e0e0;
      }

      .stats-inline .points {
        color: #74c0fc;
        font-weight: bold;
      }

      .expand-btn {
        background: none;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #e0e0e0;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        min-width: 24px;
      }

      .expand-btn:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .stats-expanded {
        padding: 15px;
        background: rgba(0, 0, 0, 0.2);
      }

      .stats-expanded.collapsed {
        display: none;
      }

      .upgrade-section {
        color: #e0e0e0;
      }

      .stat-upgrade-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding: 8px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 6px;
      }

      .stat-info {
        display: flex;
        justify-content: space-between;
        min-width: 120px;
      }

      .upgrade-controls {
        display: flex;
        gap: 6px;
      }

      .upgrade-btn {
        background: #a6e3a1;
        color: #1e1e2e;
        border: none;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        font-weight: bold;
      }

      .upgrade-btn:hover {
        background: #94d3a2;
      }

      .upgrade-btn:disabled {
        background: #6c7086;
        cursor: not-allowed;
      }

      .upgrade-note {
        font-size: 11px;
        color: #a6adc8;
        text-align: center;
        margin-top: 10px;
        font-style: italic;
      }

      .sidebar-menu {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .sidebar-menu li:last-child {
        border-bottom: none;
      }

      .sidebar-menu a {
        display: flex;
        align-items: center;
        padding: 12px 20px;
        color: #e0e0e0;
        text-decoration: none;
        transition: all 0.2s ease;
        font-size: 14px; /* You can change this value */
      }

      .sidebar-menu a:hover {
        background-color: #252525;
        color: #FFD369;
      }

      .sidebar-menu img {
        width: 24px;
        height: 24px;
        margin-right: 12px;
        object-fit: cover;
        border-radius: 4px;
      }

      .sidebar-menu-expandable {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-right: 20px;
      }

      .sidebar-menu-expandable a {
        flex: 1;
        margin: 0;
        padding: 12px 20px;
      }

      .sidebar-menu-expandable .expand-btn {
        margin-left: 10px;
      }

      .sidebar-submenu {
        background: rgba(0, 0, 0, 0.3);
        padding: 15px 20px;
        margin: 0;
      }

      .sidebar-submenu.collapsed {
        display: none;
      }

      .coming-soon-text {
        color: #f38ba8;
        font-size: 12px;
        text-align: center;
        font-style: italic;
      }

      .content-area {
        flex: 1;
        padding: 20px;
        margin-left: 250px;
        transition: all .5s ease;
      }

      .content-area.full {
        margin-left: 0;
      }

      .settings-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .settings-content {
        background: #1e1e2e;
        border: 2px solid #cba6f7;
        border-radius: 15px;
        padding: 30px;
        max-width: 500px;
        width: 90%;
        color: #cdd6f4;
        margin: 10px 0;
        height: -webkit-fill-available;
        overflow: auto;
      }

      .settings-section {
        margin-bottom: 25px;
      }

      .settings-section h3 {
        color: #f38ba8;
        margin-bottom: 15px;
        border-bottom: 1px solid #585b70;
        padding-bottom: 8px;
      }

      .color-palette {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 10px;
        margin-top: 10px;
      }

      .color-option {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        border: 2px solid transparent;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .color-option:hover {
        transform: scale(1.1);
      }

      .color-option.selected {
        border-color: #cba6f7;
        box-shadow: 0 0 10px rgba(203, 166, 247, 0.5);
      }

      .settings-button {
        background: #cba6f7;
        color: #1e1e2e;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        cursor: pointer;
        margin-right: 10px;
        margin-top: 10px;
      }

      .settings-button:hover {
        background: #a281d4;
      }

      .sidebar-quick-access {
        max-height: 300px;
        overflow-y: auto;
      }

      .quick-access-empty {
        color: #888;
        font-size: 12px;
        text-align: center;
        padding: 10px;
        font-style: italic;
      }

      .quick-access-item {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 6px;
        padding: 8px;
        margin-bottom: 8px;
      }

      .qa-item-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }

      .qa-item-info {
        flex: 1;
        min-width: 0;
      }

      .qa-item-name {
        font-size: 11px;
        font-weight: bold;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .qa-item-price, .qa-item-stats {
        font-size: 10px;
        color: #888;
      }

      .qa-remove-btn {
        background: #f38ba8;
        color: white;
        border: none;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .qa-item-actions {
        display: flex;
        gap: 4px;
      }

      .qa-buy-btn, .qa-use-btn, .qa-equip-btn {
        background: #a6e3a1;
        color: #1e1e2e;
        border: none;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 10px;
        font-weight: bold;
      }

      .qa-buy-btn:hover, .qa-use-btn:hover, .qa-equip-btn:hover {
        background: #94d3a2;
      }

      .qa-buy-btn:disabled {
        background: #6c7086;
        cursor: not-allowed;
      }

      .qa-use-btn {
        background: #74c0fc;
      }

      .qa-use-btn:hover {
        background: #5aa3e0;
      }

      .qa-use-multiple-btn {
        background: #f9e2af;
        color: #1e1e2e;
        border: none;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 10px;
        font-weight: bold;
        margin-left: 4px;
      }

      .qa-use-multiple-btn:hover {
        background: #e6d196;
      }

      .qa-equip-btn {
        background: #f9e2af;
      }

      .qa-equip-btn:hover {
        background: #e6d196;
      }

      /* Stats menu item text sizing */
      #stats-menu-text {
        font-size: 13px; /* Change this to make stats text bigger/smaller */
      }

      #stats-menu-text span {
        font-weight: bold;
        margin: 0 2px;
      }

      /* Event table styling for side-by-side display */
      .event-table {
        table-layout: auto;
        width: 100%;
        border-collapse: collapse;
        background: rgba(30, 30, 46, 0.8);
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: 10px;
      }

      .event-table th,
      .event-table td {
        padding: 1px 5px;
        text-align: left;
        border-bottom: 1px solid rgba(88, 91, 112, 0.3);
      }

      .event-table th {
        background: rgba(203, 166, 247, 0.2);
        color: #cba6f7;
        font-weight: bold;
      }

      .event-table tr:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      /* Shrink the Player column to fit content only */
      .event-table td:nth-child(2) {
        width: 1%;
        white-space: nowrap;
      }

      /* Tighten damage column spacing */
      .event-table td.right {
        padding-left: 5px;
        text-align: right;
      }

      /* PvP chip Style */
      .pvp-chip {
        text-align: center;
        color: #fafafa;
        border-radius: 999px;
        padding: 4px 6px;
        font-weight: 600;
        font-size: 12px;
      }

      .pvp-chip.danger {
        background: #bb2d2d;
        border: 1px solid #d33939;
      }

      .pvp-chip.success {
        background: #3ddd65;
        border: 1px solid #45e26d;
      }

      @media (min-width:601px) {
        #game-sidebar {
          height: calc(100% - 74px);
          top: 56px;;
        }

        #extension-enemy-loot-container {
          display: inline-flex;
        }

        #extension-loot-container {
          display: ruby;
          max-width: 50%;
        }

        #extension-loot-container .loot-card {
          width: 50%;
        }
      }

      @media (max-width:600px) {
        body {
          padding-right: 0;
          padding-top: 70px;
        }

        .content-area.full {
          width: -webkit-fill-available;
          top: 74px;
        }

        .sidebar-toggle {
          background: linear-gradient(90deg, #b73bf6, #7022ee);
        }

        .content-area.full .panel {
          width: -webkit-fill-available;
        }

        .ranking-wrapper {
          flex-wrap: wrap
        }

        #extension-enemy-loot-container {
          display: flex;
          flex-flow: column;
          flex-wrap: wrap;
          gap: 16px;
        }

        #extension-loot-container {
          display: flex;
          flex-flow: wrap;
          justify-content: space-between;
        }

        #extension-loot-container .loot-card {
          width: 42%;
        }
      }
    `;
    document.head.appendChild(style);

    initSidebarExpandables();
    initSettingsModal();
    fetchAndUpdateSidebarStats();
    initPvPAutomationButton();
    initFarmingAutomationButton();

    if(!resizeListener) {
      resizeListener = window.addEventListener('resize', () => {
        handleSidebarResize();
      });
    }
    
    function handleSidebarResize() {
      if(isMobileView && !contentArea.classList.contains('full') && extensionSettings.sidebarVisible) {
        sidebar.classList.add('hide')
        contentArea.classList.add('full')
        sidebarToggle.classList.remove('hide')
      } else if (!isMobileView && contentArea.classList.contains('full') && extensionSettings.sidebarVisible) {
        contentArea.classList.remove('full')
        sidebarToggle.classList.add('hide')
        sidebar.classList.remove('hide')
      }
    }
    
    // Update farming HUD periodically
    setInterval(() => {
      if (document.getElementById('farming-hud')) {
        updateFarmingHUD();
      }
    }, 2000);
    
    // Refresh stats every 30 seconds
    setInterval(fetchAndUpdateSidebarStats, 30000);
  }

  function initSidebarExpandables() {
    const statsExpandBtn = document.getElementById('stats-expand-btn');
    const statsExpanded = document.getElementById('stats-expanded');

    if (statsExpandBtn && statsExpanded) {
      statsExpandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = statsExpanded.classList.contains('collapsed');

        if (isCollapsed) {
          statsExpanded.classList.remove('collapsed');
          statsExpandBtn.textContent = '–';
          extensionSettings.statsExpanded = true;
        } else {
          statsExpanded.classList.add('collapsed');
          statsExpandBtn.textContent = '+';
          extensionSettings.statsExpanded = false;
        }

        saveSettings();
      });

      if (extensionSettings.statsExpanded) {
        statsExpanded.classList.remove('collapsed');
        statsExpandBtn.textContent = '–';
      } else {
        statsExpanded.classList.add('collapsed');
        statsExpandBtn.textContent = '+';
      }
    }

    // Add programmatic event listeners for stat upgrade buttons
    const upgradeControls = document.querySelectorAll('.upgrade-controls');
    upgradeControls.forEach(controls => {
      const plus1Btn = controls.querySelector('button:first-child');
      const plus5Btn = controls.querySelector('button:last-child');
      
      if (plus1Btn) {
        plus1Btn.addEventListener('click', () => {
          const statRow = controls.closest('.stat-upgrade-row');
          const stat = statRow?.dataset.stat || 'attack';
          sidebarAlloc(stat, 1);
        });
      }
      
      if (plus5Btn) {
        plus5Btn.addEventListener('click', () => {
          const statRow = controls.closest('.stat-upgrade-row');
          const stat = statRow?.dataset.stat || 'attack';
          sidebarAlloc(stat, 5);
        });
      }
    });

    const petsExpandBtn = document.getElementById('pets-expand-btn');
    const petsExpanded = document.getElementById('pets-expanded');

    if (petsExpandBtn && petsExpanded) {
      petsExpandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = petsExpanded.classList.contains('collapsed');

        if (isCollapsed) {
          petsExpanded.classList.remove('collapsed');
          petsExpandBtn.textContent = '–';
          extensionSettings.petsExpanded = true;
        } else {
          petsExpanded.classList.add('collapsed');
          petsExpandBtn.textContent = '+';
          extensionSettings.petsExpanded = false;
        }

        saveSettings();
      });

      if (extensionSettings.petsExpanded) {
        petsExpanded.classList.remove('collapsed');
        petsExpandBtn.textContent = '–';
      }
    }

    const blacksmithExpandBtn = document.getElementById('blacksmith-expand-btn');
    const blacksmithExpanded = document.getElementById('blacksmith-expanded');

    if (blacksmithExpandBtn && blacksmithExpanded) {
      blacksmithExpandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = blacksmithExpanded.classList.contains('collapsed');

        if (isCollapsed) {
          blacksmithExpanded.classList.remove('collapsed');
          blacksmithExpandBtn.textContent = '–';
          extensionSettings.blacksmithExpanded = true;
        } else {
          blacksmithExpanded.classList.add('collapsed');
          blacksmithExpandBtn.textContent = '+';
          extensionSettings.blacksmithExpanded = false;
        }

        saveSettings();
      });

      if (extensionSettings.blacksmithExpanded) {
        blacksmithExpanded.classList.remove('collapsed');
        blacksmithExpandBtn.textContent = '–';
      }
    }

    const merchantExpandBtn = document.getElementById('merchant-expand-btn');
    const merchantExpanded = document.getElementById('merchant-expanded');

    if (merchantExpandBtn && merchantExpanded) {
      merchantExpandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = merchantExpanded.classList.contains('collapsed');

        if (isCollapsed) {
          merchantExpanded.classList.remove('collapsed');
          merchantExpandBtn.textContent = '–';
          extensionSettings.merchantExpanded = true;
        } else {
          merchantExpanded.classList.add('collapsed');
          merchantExpandBtn.textContent = '+';
          extensionSettings.merchantExpanded = false;
        }

        saveSettings();
        updateSidebarMerchantSection();
      });

      if (extensionSettings.merchantExpanded) {
        merchantExpanded.classList.remove('collapsed');
        merchantExpandBtn.textContent = '–';
      }
      updateSidebarMerchantSection();
    }

    const inventoryExpandBtn = document.getElementById('inventory-expand-btn');
    const inventoryExpanded = document.getElementById('inventory-expanded');

    if (inventoryExpandBtn && inventoryExpanded) {
      inventoryExpandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = inventoryExpanded.classList.contains('collapsed');

        if (isCollapsed) {
          inventoryExpanded.classList.remove('collapsed');
          inventoryExpandBtn.textContent = '–';
          extensionSettings.inventoryExpanded = true;
        } else {
          inventoryExpanded.classList.add('collapsed');
          inventoryExpandBtn.textContent = '+';
          extensionSettings.inventoryExpanded = false;
        }

        saveSettings();
        updateSidebarInventorySection();
      });

      // Refresh inventory button
      const refreshBtn = document.getElementById('refresh-inventory-btn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          showNotification('Refreshing inventory quantities...', 'info');
          refreshPinnedItemQuantities();
        });
      }

      if (extensionSettings.inventoryExpanded) {
        inventoryExpanded.classList.remove('collapsed');
        inventoryExpandBtn.textContent = '–';
      }
      updateSidebarInventorySection();
    }

    const automationExpandBtn = document.getElementById('automation-expand-btn');
    const automationExpanded = document.getElementById('automation-expanded');

    if (automationExpandBtn && automationExpanded) {
      automationExpandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = automationExpanded.classList.contains('collapsed');

        if (isCollapsed) {
          automationExpanded.classList.remove('collapsed');
          automationExpandBtn.textContent = '–';
          extensionSettings.automationExpanded = true;
        } else {
          automationExpanded.classList.add('collapsed');
          automationExpandBtn.textContent = '+';
          extensionSettings.automationExpanded = false;
        }

        saveSettings();
      });

      if (extensionSettings.automationExpanded) {
        automationExpanded.classList.remove('collapsed');
        automationExpandBtn.textContent = '–';
      }
    }
  }

  function initSettingsModal() {
    document.getElementById('settings-link').addEventListener('click', (e) => {
      e.preventDefault();
      showSettingsModal();
    });
  }

  function showSettingsModal() {
    let modal = document.getElementById('settings-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'settings-modal';
      modal.className = 'settings-modal';

      modal.innerHTML = `
        <div class="settings-content">
          <h2 style="color: #cba6f7; margin-bottom: 25px; text-align: center;">Settings</h2>

          <div class="settings-section">
            <h3>Sidebar Color</h3>
            <p>Choose a color for the side panel:</p>
            <div class="color-palette" id="sidebar-colors">
              <div class="color-option" style="background: #1e1e2e" data-color="#1e1e2e" title="Dark Blue"></div>
              <div class="color-option" style="background: #2d2d3d" data-color="#2d2d3d" title="Dark Gray"></div>
              <div class="color-option" style="background: #1a1a2e" data-color="#1a1a2e" title="Night Blue"></div>
              <div class="color-option" style="background: #16213e" data-color="#16213e" title="Navy"></div>
              <div class="color-option" style="background: #0f3460" data-color="#0f3460" title="Ocean Blue"></div>
              <div class="color-option" style="background: #533483" data-color="#533483" title="Purple"></div>
              <div class="color-option" style="background: #7209b7" data-color="#7209b7" title="Violet"></div>
              <div class="color-option" style="background: #2d1b69" data-color="#2d1b69" title="Deep Purple"></div>
              <div class="color-option" style="background: #0b6623" data-color="#0b6623" title="Forest Green"></div>
              <div class="color-option" style="background: #000000" data-color="#000000" title="Black"></div>
              <div class="color-option" style="background: linear-gradient(145deg, #272727, #000000)" data-color="linear-gradient(145deg, #272727, #000000)" title="Misty Gray"></div>
              <div class="color-option" style="background: linear-gradient(145deg, #3c1053, #0f0029)" data-color="linear-gradient(145deg, #3c1053, #0f0029)" title="Sweet Purple"></div>
            </div>
          </div>

          <div class="settings-section">
            <h3>Background Color</h3>
            <p>Choose a background color for the webpage:</p>
            <div class="color-palette" id="background-colors">
              <div class="color-option" style="background: #000000" data-color="#000000" title="Black"></div>
              <div class="color-option" style="background: #1a1a1a" data-color="#1a1a1a" title="Very Dark Gray"></div>
              <div class="color-option" style="background: #2d2d2d" data-color="#2d2d2d" title="Dark Gray"></div>
              <div class="color-option" style="background: #0f0f23" data-color="#0f0f23" title="Dark Blue"></div>
              <div class="color-option" style="background: #1a0033" data-color="#1a0033" title="Dark Purple"></div>
              <div class="color-option" style="background: #001a00" data-color="#001a00" title="Dark Green"></div>
              <div class="color-option" style="background: #1a0000" data-color="#1a0000" title="Dark Red"></div>
              <div class="color-option" style="background: #001a1a" data-color="#001a1a" title="Dark Teal"></div>
              <div class="color-option" style="background: #1a1a00" data-color="#1a1a00" title="Dark Yellow"></div>
              <div class="color-option" style="background: #0a0a0a" data-color="#0a0a0a" title="Almost Black"></div>
              <div class="color-option" style="background: #404040" data-color="#404040" title="Medium Gray"></div>
              <div class="color-option" style="background: #1e1e2e" data-color="#1e1e2e" title="Blue Gray"></div>
            </div>
          </div>

          <div class="settings-section">
            <h3>🍯 Multiple Potion Usage</h3>
            <p>Enable quick multiple potion usage in inventory quick access:</p>
            <div style="margin: 15px 0;">
              <label style="display: flex; align-items: center; gap: 10px; color: #cdd6f4; margin-bottom: 10px;">
                <input type="checkbox" id="multiple-pots-enabled" style="transform: scale(1.2);">
                <span>Enable multiple potion usage</span>
              </label>
              <div style="display: flex; align-items: center; gap: 10px; color: #cdd6f4;">
                <label for="multiple-pots-count">Number of potions to use:</label>
                <input type="number" id="multiple-pots-count" min="2" max="10" value="3" 
                       style="width: 60px; padding: 5px; background: #1e1e2e; color: #cdd6f4; border: 1px solid #45475a; border-radius: 4px;">
              </div>
            </div>
          </div>

          <div class="settings-section">
            <h3 style="color: #f9e2af; margin-bottom: 15px;">📌 Pinned Items</h3>
            <div style="margin: 15px 0;">
              <div style="display: flex; align-items: center; gap: 10px; color: #cdd6f4;">
                <label for="pinned-items-limit">Maximum pinned items:</label>
                <input type="number" id="pinned-items-limit" min="1" max="10" value="3" 
                       style="width: 60px; padding: 5px; background: #1e1e2e; color: #cdd6f4; border: 1px solid #45475a; border-radius: 4px;">
              </div>
            </div>
          </div>

          <div class="settings-section">
            <h3 style="color: #f9e2af; margin-bottom: 15px;">⚔️ PvP Setting</h3>
            <div style="margin: 15px 0;">
              <label style="display: flex; align-items: center; gap: 10px; color: #cdd6f4; margin-bottom: 10px;">
                <input type="checkbox" id="autosurrender-function-enable" style="transform: scale(1.2);">
                <span>Enable Auto Surrender in PvP (when losing)</span>
              </label>
            </div>
          </div>

          <div class="settings-section">
            <h3 style="color: #f9e2af; margin-bottom: 15px;">🌽 Farm Setting</h3>
            <div style="margin: 15px 0;">
              <div style="display:flex; flex-flow: column; gap: 8px; color: #cdd6f4; margin-bottom: 1rem;">
                <label for="autologin-value-email">Energy Farming Mode:</label>
                <select id="autofarm-value-mode" style="padding: 5px; background: #1e1e2e; color: #cdd6f4; border: 1px solid #45475a; border-radius: 4px;">
                  <option value="energy-cap">Energy Cap</option>
                  <option value="energy-target">Energy Target</option>
                </select>
              </div>
              <div style="display:flex; flex-flow: column; gap: 8px; color: #cdd6f4; margin-bottom: 1rem;">
                <label for="autologin-value-energy-cap">Energy Cap:</label>
                <input type="number" id="autofarm-value-energy-cap" 
                  style="padding: 5px; background: #1e1e2e; color: #cdd6f4; border: 1px solid #45475a; border-radius: 4px;" min="0">
              </div>
              <div style="display:flex; flex-flow: column; gap: 8px; color: #cdd6f4; margin-bottom: 1rem;">
                <label for="autologin-value-energy-target">Energy Target:</label>
                <input type="number" id="autofarm-value-energy-target" 
                  style="padding: 5px; background: #1e1e2e; color: #cdd6f4; border: 1px solid #45475a; border-radius: 4px;" min="0">
              </div>
              <label style="display: flex; align-items: center; gap: 10px; color: #cdd6f4; margin-bottom: 10px;">
                <input type="checkbox" id="autologin-function-enable" style="transform: scale(1.2);">
                <span>Enable Autologin when Autofarm Energy</span>
              </label>
            </div>
          </div>

          <div class="settings-section">
            <h3 style="color: #f9e2af; margin-bottom: 15px;">🔐 Autologin Value</h3>
            <div style="margin: 15px 0;">
              <div style="display:flex; flex-flow: column; gap: 8px; color: #cdd6f4; margin-bottom: 1rem;">
                <label for="autologin-value-email">Email:</label>
                <input type="email" id="autologin-value-email" 
                  style="padding: 5px; background: #1e1e2e; color: #cdd6f4; border: 1px solid #45475a; border-radius: 4px;">
              </div>
              <div style="display:flex; flex-flow: column; gap: 8px; color: #cdd6f4; margin-bottom: 1rem;">
                <label for="autologin-value-password">Password:</label>
                <input type="password" id="autologin-value-password" 
                  style="padding: 5px; background: #1e1e2e; color: #cdd6f4; border: 1px solid #45475a; border-radius: 4px;">
              </div>
              *Email and Password will be saved in your session with encryption, so please be carefull when use this feature
            </div>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <button class="settings-button" data-action="close">Close</button>
            <button class="settings-button" data-action="reset">Reset to Default</button>
            <button class="settings-button" data-action="clear" style="background: #f38ba8;">Clear All Data</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      setupColorSelectors();
      updateColorSelections();
      setupMultiplePotionSettings();
      setupPinnedItemsLimitSettings();
      setupAutofarmSettings();
      setupSettingsModalListeners();
    }

    modal.style.display = 'flex';

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeSettingsModal();
      }
    });
  }

  function setupColorSelectors() {
    document.querySelectorAll('#sidebar-colors .color-option').forEach(option => {
      option.addEventListener('click', () => {
        const color = option.dataset.color;
        extensionSettings.sidebarColor = color;
        saveSettings();
        applySettings();
        updateColorSelections();
      });
    });

    document.querySelectorAll('#background-colors .color-option').forEach(option => {
      option.addEventListener('click', () => {
        const color = option.dataset.color;
        extensionSettings.backgroundColor = color;
        saveSettings();
        applySettings();
        updateColorSelections();
      });
    });
  }

  function setupMultiplePotionSettings() {
    const enabledCheckbox = document.getElementById('multiple-pots-enabled');
    const countInput = document.getElementById('multiple-pots-count');
    
    if (enabledCheckbox) {
      enabledCheckbox.checked = extensionSettings.multiplePotsEnabled;
      console.log('Multiple pots enabled:', extensionSettings.multiplePotsEnabled);
      enabledCheckbox.addEventListener('change', (e) => {
        extensionSettings.multiplePotsEnabled = e.target.checked;
        console.log('Multiple pots enabled changed to:', extensionSettings.multiplePotsEnabled);
        saveSettings();
        updateSidebarInventorySection(); // Refresh to show/hide multiple use buttons
      });
    }
    
    if (countInput) {
      countInput.value = extensionSettings.multiplePotsCount;
      console.log('Multiple pots count:', extensionSettings.multiplePotsCount);
      countInput.addEventListener('change', (e) => {
        const value = Math.max(2, Math.min(10, parseInt(e.target.value) || 3));
        extensionSettings.multiplePotsCount = value;
        e.target.value = value; // Ensure value is within bounds
        console.log('Multiple pots count changed to:', extensionSettings.multiplePotsCount);
        saveSettings();
        updateSidebarInventorySection(); // Refresh to update button text
      });
    }
  }

  function setupPinnedItemsLimitSettings() {
    const limitInput = document.getElementById('pinned-items-limit');
    
    if (limitInput) {
      limitInput.value = extensionSettings.pinnedItemsLimit;
      console.log('Pinned items limit:', extensionSettings.pinnedItemsLimit);
      limitInput.addEventListener('change', (e) => {
        const value = Math.max(1, Math.min(10, parseInt(e.target.value) || 3));
        extensionSettings.pinnedItemsLimit = value;
        e.target.value = value; // Ensure value is within bounds
        console.log('Pinned items limit changed to:', extensionSettings.pinnedItemsLimit);
        saveSettings();
      });
    }
  }

  function setupAutofarmSettings() {
    const modeSelect = document.getElementById('autofarm-value-mode');
    const energyCapInput = document.getElementById('autofarm-value-energy-cap');
    const energyTargetInput = document.getElementById('autofarm-value-energy-target');
    const autoSurrenderCheckbox = document.getElementById('autosurrender-function-enable');
    
    if (modeSelect) {
      modeSelect.value = extensionSettings.farmingMode;
      modeSelect.addEventListener('change', (e) => {
        extensionSettings.farmingMode = e.target.value;
        saveSettings();
      });
    }
    
    if (energyCapInput) {
      energyCapInput.value = extensionSettings.energyCap;
      energyCapInput.addEventListener('change', (e) => {
        const value = Math.max(0, parseInt(e.target.value) || 30);
        extensionSettings.energyCap = value;
        saveSettings();
      });
    }
    
    if (energyTargetInput) {
      energyTargetInput.value = extensionSettings.energyTarget;
      energyTargetInput.addEventListener('change', (e) => {
        const value = Math.max(0, parseInt(e.target.value) || 150);
        extensionSettings.energyTarget = value;
        saveSettings();
      });
    }
    
    if (autoSurrenderCheckbox) {
      autoSurrenderCheckbox.checked = extensionSettings.autoSurrenderEnabled;
      autoSurrenderCheckbox.addEventListener('change', (e) => {
        extensionSettings.autoSurrenderEnabled = e.target.checked;
        saveSettings();
      });
    }
  }

  function setupAutologinSettings() {
    const enabledCheckbox = document.getElementById('autologin-function-enable');
    const emailInput = document.getElementById('autologin-value-email');
    const passwordInput = document.getElementById('autologin-value-password');
    
    // Load saved values using encryption
    const savedEnabled = sessionStorage.getItem('autologin-enabled') === 'true';
    const savedEmail = window.secureCredentials ? window.secureCredentials.getEmail() : '';
    const savedPassword = window.secureCredentials ? window.secureCredentials.getPassword() : '';
    
    if (enabledCheckbox) {
      enabledCheckbox.checked = savedEnabled;
      enabledCheckbox.addEventListener('change', (e) => {
        sessionStorage.setItem('autologin-enabled', e.target.checked.toString());
      });
    }
    
    if (emailInput) {
      emailInput.value = savedEmail;
      emailInput.addEventListener('change', (e) => {
        if (window.secureCredentials) {
          window.secureCredentials.saveEmail(e.target.value);
        }
      });
    }
    
    if (passwordInput) {
      passwordInput.value = savedPassword;
      passwordInput.addEventListener('change', (e) => {
        if (window.secureCredentials) {
          window.secureCredentials.savePassword(e.target.value);
        }
      });
    }
  }

  // Autologin functions
  function autoLogin() {
    if (!window.location.href.includes("signin.php")) return false;
    
    const isEnabled = sessionStorage.getItem('autologin-enabled') === 'true';
    if (!isEnabled) return false;
    
    const email = window.secureCredentials ? window.secureCredentials.getEmail() : '';
    const password = window.secureCredentials ? window.secureCredentials.getPassword() : '';
    
    if (!email || !password) return false;
    
    const emailInput = document.evaluate('//*[@id="login-container"]/form/input[1]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    const passwordInput = document.evaluate('//*[@id="login-container"]/form/input[2]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    const loginBtn = document.evaluate('//*[@id="login-container"]/form/input[3]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    
    if (emailInput && passwordInput && loginBtn) {
      emailInput.value = email;
      passwordInput.value = password;
      loginBtn.click();
      return true;
    }
    return false;
  }

  function checkLoginOnChapterPage() {
    if (!window.location.href.includes("/chapter/")) return false;
    
    const isEnabled = sessionStorage.getItem('autologin-enabled') === 'true';
    const isFarmingRunning = getFarmingAutomation();
    
    if (!isEnabled || !isFarmingRunning) return false;
    
    const loginBtn = document.evaluate(
      '//*[@id="discuscontainer"]/div[1]/div[3]/div[5]/a[1]',
      document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
    ).singleNodeValue;
    
    if (loginBtn) {
      sessionStorage.setItem("veyra_resume_page", window.location.href);
      window.location.href = "https://demonicscans.org/signin.php";
      return true;
    }
    return false;
  }

  function handleResumeAfterLogin() {
    const resumePage = sessionStorage.getItem("veyra_resume_page");
    if (resumePage && resumePage !== window.location.href) {
      sessionStorage.removeItem("veyra_resume_page");
      window.location.href = resumePage;
      return true;
    }
    return false;
  }

  function setupSettingsModalListeners() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;

    // Close button
    modal.querySelector('.settings-button[data-action="close"]')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeSettingsModal();
    });

    // Reset button
    modal.querySelector('.settings-button[data-action="reset"]')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      resetSettings();
    });

    // Clear All Data button
    modal.querySelector('.settings-button[data-action="clear"]')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearAllData();
    });

    // Setup autologin settings
    setupAutologinSettings();
  }

  function updateColorSelections() {
    document.querySelectorAll('.color-option').forEach(option => {
      option.classList.remove('selected');
    });

    document.querySelectorAll('#sidebar-colors .color-option').forEach(option => {
      if (option.dataset.color === extensionSettings.sidebarColor) {
        option.classList.add('selected');
      }
    });

    document.querySelectorAll('#background-colors .color-option').forEach(option => {
      if (option.dataset.color === extensionSettings.backgroundColor) {
        option.classList.add('selected');
      }
    });
  }

  function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  function resetSettings() {
    extensionSettings = {
      sidebarColor: '#1e1e2e',
      backgroundColor: '#000000',
      statAllocationCollapsed: true,
      statsExpanded: false,
      petsExpanded: false,
      blacksmithExpanded: false,
      continueBattlesExpanded: true,
      lootExpanded: true,
      merchantExpanded: false,
      inventoryExpanded: false,
      pinnedMerchantItems: [],
      pinnedInventoryItems: [],
      multiplePotsEnabled: false,
      multiplePotsCount: 3,
      pinnedItemsLimit: 3,
      farmingMode: 'energy-cap',
      energyCap: 30,
      energyTarget: 150,
    };
    saveSettings();
    applySettings();
    updateColorSelections();
    updateSidebarMerchantSection();
    updateSidebarInventorySection();
    showNotification('Settings reset to default!', 'success');
  }

  function clearAllData() {
    if (confirm('Are you sure you want to clear ALL extension data? This will remove all settings, pinned items, and preferences. This action cannot be undone.')) {
      // Clear all extension-related localStorage data
      localStorage.removeItem('demonGameExtensionSettings');
      localStorage.removeItem('demonGameFilterSettings');
      localStorage.removeItem('inventoryView');
      
      // Reset extension settings to default
      extensionSettings = {
        sidebarColor: '#1e1e2e',
        backgroundColor: '#000000',
        statAllocationCollapsed: true,
        statsExpanded: false,
        petsExpanded: false,
        blacksmithExpanded: false,
        continueBattlesExpanded: true,
        lootExpanded: true,
        merchantExpanded: false,
        inventoryExpanded: false,
        pinnedMerchantItems: [],
        pinnedInventoryItems: [],
        multiplePotsEnabled: false,
        multiplePotsCount: 3,
        pinnedItemsLimit: 3,
        farmingMode: 'energy-cap',
        energyCap: 30,
        energyTarget: 150,
        autoSurrenderEnabled: false,
        autoSurrenderEnabled: false,
      };
      
      // Apply default settings
      applySettings();
      updateSidebarMerchantSection();
      updateSidebarInventorySection();
      
      // Close settings modal
      closeSettingsModal();
      
      showNotification('All extension data has been cleared!', 'success');
      
      // Reload page to ensure clean state
      setTimeout(() => {
        if (confirm('Reload the page to complete the reset?')) {
          window.location.reload();
        }
      }, 2000);
    }
  }

  // Debug function for troubleshooting
  function debugExtension() {
    console.log('Extension Debug Info:');
    console.log('User ID:', userId);
    console.log('Current Path:', window.location.pathname);
    console.log('Extension Settings:', extensionSettings);
    console.log('Pinned Merchant Items:', extensionSettings.pinnedMerchantItems);
    console.log('Pinned Inventory Items:', extensionSettings.pinnedInventoryItems);
    
    const sidebar = document.getElementById('game-sidebar');
    console.log('Sidebar Element:', sidebar ? 'Found' : 'Not Found');
    
    const merchantSection = document.getElementById('merchant-expanded');
    console.log('Merchant Section:', merchantSection ? 'Found' : 'Not Found');
    
    const inventorySection = document.getElementById('inventory-expanded');
    console.log('Inventory Section:', inventorySection ? 'Found' : 'Not Found');
    
    // Check for notification element
    const notification = document.getElementById('notification');
    console.log('Notification Element:', notification ? 'Found' : 'Not Found');
  }

  // Make debug function globally available
  window.debugExtension = debugExtension;

  // Error handling wrapper for all functions
  function safeExecute(func, context = 'Unknown') {
    try {
      return func();
    } catch (error) {
      console.error(`Error in ${context}:`, error);
      if (typeof showNotification === 'function') {
        showNotification(`Error in ${context}: ${error.message}`, 'error');
      }
    }
  }

  // MAIN INITIALIZATION
  // Always initialize farming automation on main site pages
  if (window.location.hostname === 'demonicscans.org' && !window.location.pathname.includes('.php')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => safeExecute(initFarmingAutomation, 'Farming Automation'));
    } else {
      safeExecute(initFarmingAutomation, 'Farming Automation');
    }
  }
  
  // Initialize game extension only on game pages
  if (document.querySelector('.game-topbar')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => safeExecute(initializeExtension, 'DOMContentLoaded'));
    } else {
      safeExecute(initializeExtension, 'Direct Initialization');
    }
  }

  function initializeExtension() {
    console.log('Demon Game Enhancement v3.0 - Initializing...');
    
    // Initialize encryption utilities
    safeExecute(() => initSecureCredentials(), 'Initialize Encryption');
    
    // Load settings first
    safeExecute(() => loadSettings(), 'Load Settings');
    
    // Initialize sidebar
    safeExecute(() => initSideBar(), 'Sidebar Initialization');
    
    // Disable dragging on interactive elements
    safeExecute(() => initDraggableFalse(), 'Disable Dragging');
    
    // Initialize page-specific functionality
    safeExecute(() => initPageSpecificFunctionality(), 'Page-Specific Functionality');
    
    console.log('Demon Game Enhancement v3.0 - Initialization Complete!');
    console.log('Type debugExtension() in console for debug info');
  }

  function initSecureCredentials() {
    if (!window.secureCredentials) {
      window.secureCredentials = new SecureCredentials();
    }
  }


  function initPageSpecificFunctionality() {
    const currentPath = window.location.pathname;

    for (const [path, handler] of Object.entries(extensionPageHandlers)) {
      if (currentPath.includes(path)) {
        console.log(`Initializing ${path} functionality`);
        handler();
        break;
      }
    }
  }

  // Enhanced Quick Access Pinning System - Universal Sidebar Shortcuts

  // INVENTORY QUICK ACCESS FUNCTIONS
  function addInventoryQuickAccessButtons() {
      // Only run on inventory page
      if (!window.location.pathname.includes('inventory.php')) return;
      
      let attempts = 0;
      const maxAttempts = 50;
      
      const checkAndAddButtons = () => {
          attempts++;
          
          // Look for inventory items (both equipped and unequipped sections)
          const inventoryItems = document.querySelectorAll('.slot-box:not(.empty):not([data-pin-added])');
          
          if (inventoryItems.length === 0) {
              if (attempts < maxAttempts) {
                  setTimeout(checkAndAddButtons, 100);
              }
      return;
    }

          console.log(`Adding pin buttons to ${inventoryItems.length} inventory items`);
          
          inventoryItems.forEach(item => {
              // Skip if already processed or is empty slot
              if (item.hasAttribute('data-pin-added') || item.querySelector('.empty')) return;
              
              // Extract item data properly from the DOM structure
              const itemData = extractInventoryItemData(item);
              if (!itemData) return;
              
              // Create pin button
              const pinBtn = document.createElement('button');
              pinBtn.className = 'btn extension-pin-btn';
              pinBtn.textContent = '📌 Pin';
              pinBtn.style.cssText = `
                  background: #8a2be2; 
                  color: white; 
                  margin-top: 5px; 
                  font-size: 11px; 
                  padding: 4px 8px; 
                  border: none; 
                  border-radius: 4px; 
                  cursor: pointer;
                  width: 100%;
              `;
              
              pinBtn.onclick = (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  addToInventoryQuickAccess(itemData, item);
              };
              
              // Add button to the item's label section
              const labelDiv = item.querySelector('.label');
              if (labelDiv) {
                  labelDiv.appendChild(pinBtn);
              } else {
                  item.appendChild(pinBtn);
              }
              
              // Mark as processed
              item.setAttribute('data-pin-added', 'true');
          });
      };
      
      checkAndAddButtons();
  }

  function extractInventoryItemData(item) {
      try {
          // Get item image and name
          const img = item.querySelector('img');
          const itemName = img?.alt || 'Unknown Item';
          const imageSrc = img?.src || '';
          
          // Get label with stats/description
          const labelDiv = item.querySelector('.label');
          const labelText = labelDiv?.textContent || '';
          
          // Determine item type and extract relevant info
          let itemType = 'material'; // default
          let itemId = null;
          let equipSlot = null;
          let stats = '';
          
          // Check for buttons to determine type and extract IDs
          const useButton = item.querySelector('button[onclick*="useItem"]');
          const equipButton = item.querySelector('button[onclick*="showEquipModal"]');
          const unequipButton = item.querySelector('button[onclick*="unequipItem"]');
          
          if (useButton) {
              // Consumable item - we'll use name-based lookup instead of ID
              itemType = 'consumable';
              const onclickStr = useButton.getAttribute('onclick') || '';
              const match = onclickStr.match(/useItem\(([^)]+)\)/);
              itemId = match ? match[1] : null;
          } else if (equipButton) {
              // Equipment item
              itemType = 'equipment';
              const onclickStr = equipButton.getAttribute('onclick') || '';
              const match = onclickStr.match(/showEquipModal\(\s*(\d+)\s*,\s*['"]([^'"]+)['"],\s*['"]([^'"]+)['"]\s*\)/);
              if (match) {
                  equipSlot = match[2];
                  itemId = match[3];
              }
          } else if (unequipButton) {
              itemType = 'equipped';
              const onclickStr = unequipButton.getAttribute('onclick') || '';
              const match = onclickStr.match(/unequipItem\(([^)]+)\)/);
              itemId = match ? match[1] : null;
          }
          
          // Extract stats from label
          if (labelText.includes('🔪') || labelText.includes('🛡️')) {
              const lines = labelText.split('\n').map(line => line.trim()).filter(Boolean);
              stats = lines.find(line => line.includes('🔪') || line.includes('🛡️')) || '';
          }
          
          // Get quantity if it exists
          let quantity = 1;
          const quantityMatch = labelText.match(/x(\d+)/);
          if (quantityMatch) {
              quantity = parseInt(quantityMatch[1], 10);
          }
          
          return {
              id: itemId || Date.now().toString(),
              name: itemName,
              image: imageSrc,
              type: itemType,
              equipSlot: equipSlot,
              stats: stats,
              quantity: quantity,
              rawLabel: labelText
          };
          
      } catch (error) {
          console.error('Error extracting inventory item data:', error);
          return null;
      }
  }

  async function addToInventoryQuickAccess(itemData, itemElement) {
    if (extensionSettings.pinnedInventoryItems.length >= extensionSettings.pinnedItemsLimit) {
      showNotification(`Maximum ${extensionSettings.pinnedItemsLimit} inventory items can be pinned!`, 'warning');
      return;
    }

      // For consumables, check by name instead of ID since IDs are unique per stack
      const checkKey = itemData.type === 'consumable' ? itemData.name : itemData.id;
      const alreadyPinned = extensionSettings.pinnedInventoryItems.some(item => {
          const pinnedKey = item.type === 'consumable' ? item.name : item.id;
          return pinnedKey === checkKey;
      });
      
      if (alreadyPinned) {
          showNotification(`"${itemData.name}" is already pinned!`, 'warning');
          return;
      }

    // For consumables, fetch fresh data to get current quantity
    if (itemData.type === 'consumable') {
      try {
        const freshItem = await findItemByName(itemData.name);
        if (freshItem) {
          itemData.quantity = freshItem.quantity;
          itemData.id = freshItem.itemId; // Update with current ID
          console.log(`Updated ${itemData.name} quantity to ${freshItem.quantity}`);
        }
      } catch (error) {
        console.error('Error fetching fresh item data:', error);
      }
      }

    extensionSettings.pinnedInventoryItems.push(itemData);
    saveSettings();
    updateSidebarInventorySection();
    showNotification(`Successfully pinned "${itemData.name}" to inventory quick access!`, 'success');
      
      // Update button text to show it's pinned
      const pinBtn = itemElement.querySelector('.extension-pin-btn');
      if (pinBtn) {
          pinBtn.textContent = '✓ Pinned';
          pinBtn.style.background = '#28a745';
          pinBtn.disabled = true;
      }
  }

  function removeFromInventoryQuickAccess(itemId, itemName) {
      // Use name for consumables, ID for others
      extensionSettings.pinnedInventoryItems = extensionSettings.pinnedInventoryItems.filter(item => {
          if (item.type === 'consumable') {
              return item.name !== itemName;
          }
          return item.id !== itemId;
      });
      
    saveSettings();
    updateSidebarInventorySection();
      showNotification(`Removed "${itemName || 'item'}" from inventory quick access`, 'info');
  }

  // Refresh quantities for pinned items
  async function refreshPinnedItemQuantities() {
    console.log('🔄 Refreshing pinned item quantities...');
    
    for (let item of extensionSettings.pinnedInventoryItems) {
      if (item.type === 'consumable') {
        try {
          const freshItem = await findItemByName(item.name);
          if (freshItem) {
            const oldQuantity = item.quantity;
            item.quantity = freshItem.quantity;
            item.id = freshItem.itemId;
            // Only log if quantity actually changed
            if (oldQuantity !== freshItem.quantity) {
              console.log(`✅ Refreshed ${item.name}: ${oldQuantity} → ${freshItem.quantity}`);
            }
          }
        } catch (error) {
          console.error(`Error refreshing ${item.name}:`, error);
        }
      }
    }
    saveSettings();
  }

  // Use website's native useItem function
  function useNativeItem(invId, itemId, itemName, availableQty, quantity = 1) {
      console.log(`🍯 Using ${quantity}x ${itemName} (ID: ${invId})`);
      
      // Call the website's native useItem function
      if (typeof useItem === 'function') {
          useItem(invId, itemId, itemName, availableQty);
          showNotification(`✅ Used ${quantity}x ${itemName}`, 'success');
      } else {
          console.error('Native useItem function not found');
          showNotification(`❌ Error: Native useItem function not available`, 'error');
      }
  }

  // Direct API call to use item (fallback when native function isn't available)
  async function useItemDirectly(invId, itemName, quantity = 1) {
      try {
          console.log(`🍯 Using ${quantity}x ${itemName} directly`);
          showNotification(`Using ${quantity}x ${itemName}...`, 'info');
          
          // Fetch fresh inventory to get current item ID
          const freshItem = await findItemByName(itemName);
          if (!freshItem) {
              showNotification(`❌ No ${itemName} found in inventory`, 'error');
                      return;
                  }
                  
          console.log(`🍯 Found fresh item: ${freshItem.name} (ID: ${freshItem.itemId})`);
                  
          const response = await fetch('use_item.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: `inv_id=${encodeURIComponent(freshItem.itemId)}${quantity > 1 ? `&qty=${quantity}` : ''}`
          });
          
          const result = await response.text();
          
          if (result.includes('successfully') || result.includes('Item consumed') || result.includes('success')) {
              showNotification(`✅ Used ${quantity}x ${itemName}`, 'success');
              
              // Update sidebar quantities
              setTimeout(() => {
                  updateSidebarInventorySection();
                  fetchAndUpdateSidebarStats();
              }, 500);
          } else {
              showNotification(`❌ Failed to use ${itemName}: ${result}`, 'error');
          }
      } catch (error) {
          console.error('Error using item:', error);
          showNotification(`❌ Error using ${itemName}: ${error.message}`, 'error');
      }
  }


  // UNIVERSAL INVENTORY ACTION - Works from any page
  async function executeInventoryAction(itemData, action) {
      try {
          if (action === 'use' && itemData.type === 'consumable') {
              // Use the website's native useItem function
              console.log(`Using native useItem for: ${itemData.name}`);
              
              if (typeof useItem === 'function') {
                  // Call native useItem with the stored data
                  useItem(itemData.id, itemData.itemId, itemData.name, itemData.quantity);
                  showNotification(`✅ Used ${itemData.name}`, 'success');
              } else {
                  // Use our own fetch-based approach when native function isn't available
                  await useItemDirectly(itemData.id, itemData.name, itemData.quantity);
              }
          } else if (action === 'buy' && itemData.type === 'merchant') {
              // Handle merchant item buying
              showNotification(`Visit merchant page to buy ${itemData.name}`, 'info');
              
          } else if (action === 'equip' && itemData.type === 'equipment') {
              showNotification(`Visit inventory page to equip ${itemData.name}`, 'info');
          } else {
              showNotification(`Action "${action}" not supported for this item type`, 'warning');
          }
    } catch (error) {
          showNotification(`${action} failed - script error`, 'error');
          console.error('Inventory action error:', error);
      }
  }

  // MERCHANT QUICK ACCESS FUNCTIONS
  function addMerchantQuickAccessButtons() {
      if (!window.location.pathname.includes('merchant.php')) return;
      
      let attempts = 0;
      const maxAttempts = 50;
      
      const checkAndAddButtons = () => {
          attempts++;
          
          const merchantCards = document.querySelectorAll('.card[data-merch-id]:not([data-pin-added])');
          
          if (merchantCards.length === 0) {
              if (attempts < maxAttempts) {
                  setTimeout(checkAndAddButtons, 100);
              }
              return;
          }
          
          console.log(`Adding pin buttons to ${merchantCards.length} merchant cards`);
          
          merchantCards.forEach(card => {
              const itemData = extractMerchantItemData(card);
              if (!itemData) return;
              
              const pinBtn = document.createElement('button');
              pinBtn.className = 'btn extension-pin-btn';
              pinBtn.textContent = '📌 Pin';
              pinBtn.style.cssText = `
                  background: #8a2be2; 
                  color: white; 
                  margin-top: 5px; 
                  font-size: 11px; 
                  padding: 4px 8px; 
                  border: none; 
                  border-radius: 4px; 
                  cursor: pointer;
                  width: 100%;
              `;
              
              pinBtn.onclick = (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  addToMerchantQuickAccess(itemData, card);
              };
              
              const actionsDiv = card.querySelector('.actions');
              if (actionsDiv) {
                  actionsDiv.appendChild(pinBtn);
              } else {
                  const infoDiv = card.querySelector('.info');
                  if (infoDiv) {
                      infoDiv.appendChild(pinBtn);
                  }
              }
              
              card.setAttribute('data-pin-added', 'true');
          });
      };

      const scopedStyle = document.createElement('style')
      scopedStyle.textContent = isMobileView ? '.content-area.full .panel .grid .card { flex-flow: column; }' : '';
      document.querySelector('.content-area').prepend(scopedStyle)
      checkAndAddButtons();
  }

  function extractMerchantItemData(card) {
      try {
          const merchId = card.getAttribute('data-merch-id');
          const currency = card.getAttribute('data-currency');
          const price = card.getAttribute('data-price');
          const maxQ = card.getAttribute('data-maxq');
          const bought = card.getAttribute('data-bought');
          
          const nameElement = card.querySelector('.name');
          const imgElement = card.querySelector('.thumb img');
          const priceElement = card.querySelector('.price');
          
          const itemName = nameElement?.textContent?.trim() || 'Unknown Item';
          const imageSrc = imgElement?.src || '';
          
          let priceDisplay = priceElement?.textContent?.trim() || `${price} ${currency}`;
          
          const buyButton = card.querySelector('.buy-btn');
          const canBuy = buyButton && !buyButton.disabled;
          
          const qtyInput = card.querySelector('.qty-input');
          const hasQuantityControl = !!qtyInput;
          
          return {
              id: merchId,
              name: itemName,
              image: imageSrc,
              currency: currency,
              price: parseInt(price, 10) || 0,
              priceDisplay: priceDisplay,
              maxQ: parseInt(maxQ, 10) || 0,
              bought: parseInt(bought, 10) || 0,
              canBuy: canBuy,
              hasQuantityControl: hasQuantityControl
          };
          
      } catch (error) {
          console.error('Error extracting merchant item data:', error);
          return null;
      }
  }

  function addToMerchantQuickAccess(itemData, cardElement) {
      if (extensionSettings.pinnedMerchantItems.length >= extensionSettings.pinnedItemsLimit) {
          showNotification(`Maximum ${extensionSettings.pinnedItemsLimit} merchant items can be pinned!`, 'warning');
          return;
      }
      
      const alreadyPinned = extensionSettings.pinnedMerchantItems.some(item => 
          item.id === itemData.id
      );
      
      if (alreadyPinned) {
          showNotification(`"${itemData.name}" is already pinned!`, 'warning');
          return;
      }
      
      extensionSettings.pinnedMerchantItems.push(itemData);
      saveSettings();
      updateSidebarMerchantSection();
      showNotification(`Successfully pinned "${itemData.name}" to merchant quick access!`, 'success');
      
      const pinBtn = cardElement.querySelector('.extension-pin-btn');
      if (pinBtn) {
          pinBtn.textContent = '✓ Pinned';
          pinBtn.style.background = '#28a745';
          pinBtn.disabled = true;
      }
  }

  function removeFromMerchantQuickAccess(itemId) {
      const removedItem = extensionSettings.pinnedMerchantItems.find(item => item.id === itemId);
      extensionSettings.pinnedMerchantItems = extensionSettings.pinnedMerchantItems.filter(item => item.id !== itemId);
      saveSettings();
      updateSidebarMerchantSection();
      showNotification(`Removed "${removedItem?.name || 'item'}" from merchant quick access`, 'info');
  }

  // UNIVERSAL MERCHANT BUY - Works from any page
  async function executeMerchantBuy(itemData, quantity = 1) {
      try {
          const qty = Math.max(1, Math.min(quantity || 1, 99));
          
          const response = await fetch('merchant_buy.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: `merch_id=${encodeURIComponent(itemData.id)}&qty=${encodeURIComponent(qty)}`
          });
          
          let data;
          try {
              data = await response.json();
          } catch {
              data = { status: 'error', message: 'Invalid response from server' };
          }
          
          if (data && data.status === 'success') {
              showNotification(`Bought ${qty}x ${itemData.name}!`, 'success');
              
              // Update pinned item data if server provides updated info
              if (typeof data.remaining === 'number') {
                  const pinnedItem = extensionSettings.pinnedMerchantItems.find(item => item.id === itemData.id);
                  if (pinnedItem) {
                      pinnedItem.bought = pinnedItem.maxQ - data.remaining;
                      pinnedItem.canBuy = data.remaining > 0;
                      saveSettings();
                  }
              }
              
              // Update displays
              setTimeout(() => {
                  updateSidebarMerchantSection();
                  fetchAndUpdateSidebarStats(); // Update currency display
              }, 500);
              
          } else {
              const message = data?.message || 'Purchase failed';
              const isInsufficientFunds = message.toLowerCase().includes('not enough');
              showNotification(message, isInsufficientFunds ? 'warning' : 'error');
          }
          
    } catch (error) {
          showNotification('Purchase failed - network error', 'error');
          console.error('Merchant buy error:', error);
    }
  }

  //#region Monster filters and existing functionality
  async function loadFilterSettings() {
    return new Promise((resolve) => {
      try {
        const settings = JSON.parse(localStorage.getItem('demonGameFilterSettings') || '{}');
        resolve(settings);
      } catch {
        resolve({});
      }
    });
  }

  async function initMonsterFilter() {
    const observer = new MutationObserver(async (mutations, obs) => {
      const monsterList = document.querySelectorAll('.monster-card');
      if (monsterList.length > 0) {
        obs.disconnect();
        const settings = await loadFilterSettings();
        monsterFiltersSettings = settings;
        createFilterUI(monsterList, settings);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function createFilterUI(monsterList, settings) {
    const filterContainer = document.createElement('div');
    filterContainer.style.cssText = `
      padding: 10px;
      background: #2d2d3d;
      border-radius: 5px;
      margin-bottom: 15px;
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
    `;

    filterContainer.innerHTML = `
      <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-start; justify-content: center; width: 100%;">
      <input type="text" id="monster-name-filter" placeholder="Filter by name"
               style="padding: 5px; background: #1e1e2e; color: #cdd6f4; border: 1px solid #45475a; border-radius: 4px; min-width: 150px;">
        
        <select id="wave-filter" style="padding: 5px; background: #1e1e2e; color: #cdd6f4; border: 1px solid #45475a; border-radius: 4px; min-width: 100px;">
          <option value="">All Waves</option>
          <option value="wave1">Wave 1 Only</option>
          <option value="wave2">Wave 2 Only</option>
        </select>
        
        <div style="position: relative; display: inline-block;">
          <button id="monster-type-toggle" style="padding: 5px 10px; background: #1e1e2e; color: #cdd6f4; border: 1px solid #45475a; border-radius: 4px; cursor: pointer; min-width: 120px; text-align: left;">
            Monster Types ▼
          </button>
          <div id="monster-type-dropdown" style="display: none; position: absolute; top: 100%; left: 0; background: #1e1e2e; border: 1px solid #45475a; border-radius: 4px; padding: 10px; z-index: 1000; min-width: 200px; max-height: 200px; overflow-y: auto;">
            <div style="margin-bottom: 8px; font-weight: bold; color: #cba6f7; border-bottom: 1px solid #45475a; padding-bottom: 5px;">Wave 1 Monsters</div>
            <label style="display: block; margin: 3px 0; color: #cdd6f4; font-size: 12px;">
              <input type="checkbox" value="Orc Grunt" class="monster-type-checkbox"> Orc Grunt
      </label>
            <label style="display: block; margin: 3px 0; color: #cdd6f4; font-size: 12px;">
              <input type="checkbox" value="Orc Bonecrusher" class="monster-type-checkbox"> Orc Bonecrusher
            </label>
            <label style="display: block; margin: 3px 0; color: #cdd6f4; font-size: 12px;">
              <input type="checkbox" value="Hobogoblin Spearman" class="monster-type-checkbox"> Hobogoblin Spearman
            </label>
            <label style="display: block; margin: 3px 0; color: #cdd6f4; font-size: 12px;">
              <input type="checkbox" value="Goblin Slinger" class="monster-type-checkbox"> Goblin Slinger
            </label>
            <label style="display: block; margin: 3px 0; color: #cdd6f4; font-size: 12px;">
              <input type="checkbox" value="Goblin Skirmisher" class="monster-type-checkbox"> Goblin Skirmisher
            </label>
            <div style="margin: 8px 0; font-weight: bold; color: #cba6f7; border-bottom: 1px solid #45475a; padding-bottom: 5px;">Wave 2 Monsters</div>
            <label style="display: block; margin: 3px 0; color: #cdd6f4; font-size: 12px;">
              <input type="checkbox" value="Lizardman Shadowclaw" class="monster-type-checkbox"> Lizardman Shadowclaw
            </label>
            <label style="display: block; margin: 3px 0; color: #cdd6f4; font-size: 12px;">
              <input type="checkbox" value="Troll Brawler" class="monster-type-checkbox"> Troll Brawler
            </label>
            <label style="display: block; margin: 3px 0; color: #cdd6f4; font-size: 12px;">
              <input type="checkbox" value="Lizardman Flamecaster" class="monster-type-checkbox"> Lizardman Flamecaster
            </label>
            <label style="display: block; margin: 3px 0; color: #cdd6f4; font-size: 12px;">
              <input type="checkbox" value="Troll Ravager" class="monster-type-checkbox"> Troll Ravager
            </label>
            <div style="margin-top: 8px; padding-top: 5px; border-top: 1px solid #45475a;">
              <button id="select-all-monsters" style="padding: 3px 8px; background: #a6e3a1; color: #1e1e2e; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; margin-right: 5px;">Select All</button>
              <button id="clear-monsters" style="padding: 3px 8px; background: #f38ba8; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">Clear</button>
            </div>
          </div>
        </div>
        
        <select id="hp-filter" style="padding: 5px; background: #1e1e2e; color: #cdd6f4; border: 1px solid #45475a; border-radius: 4px; min-width: 100px;">
          <option value="">All HP</option>
          <option value="low">Low HP (&lt;50%)</option>
          <option value="medium">Medium HP (50-80%)</option>
          <option value="high">High HP (&gt;80%)</option>
          <option value="full">Full HP (100%)</option>
        </select>
        
        <select id="player-count-filter" style="padding: 5px; background: #1e1e2e; color: #cdd6f4; border: 1px solid #45475a; border-radius: 4px; min-width: 100px;">
          <option value="">All Players</option>
          <option value="empty">Empty (0 players)</option>
          <option value="few">Few (&lt;10 players)</option>
          <option value="many">Many (&gt;20 players)</option>
          <option value="full">Full (30 players)</option>
        </select>
        
      <label style="display: flex; align-items: center; gap: 5px; color: #cdd6f4;">
        <input type="checkbox" id="hide-img-monsters">
        Hide images
      </label>
        
      <label style="display: flex; align-items: center; gap: 5px; color: #cdd6f4;">
        <input type="checkbox" id="battle-limit-alarm">
        Battle limit alarm
        <br>
        <input type="checkbox" id="battle-limit-alarm-sound" checked>
        <label for="battle-limit-alarm-sound" style="color: #cdd6f4; font-size: 12px;">🔊 Play alarm sound</label>
        <br>
        <div style="display: flex; align-items: center; gap: 5px; margin-top: 5px;">
          <label for="battle-limit-alarm-volume" style="color: #cdd6f4; font-size: 12px;">Volume:</label>
          <input type="range" id="battle-limit-alarm-volume" min="10" max="100" value="70" style="width: 80px;">
          <span id="battle-limit-alarm-volume-display" style="color: #cdd6f4; font-size: 12px; min-width: 30px;">70%</span>
        </div>
      </label>
        
        <button id="clear-filters" style="padding: 5px 10px; background: #f38ba8; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
          Clear All
        </button>
      </div>
    `;

    const contentArea = document.querySelector('.content-area');
    const monsterContainer = document.querySelector('.monster-container');
    if (contentArea && monsterContainer) {
      contentArea.insertBefore(filterContainer, monsterContainer);
    }

    // Add event listeners for all filter elements
    document.getElementById('monster-name-filter').addEventListener('input', applyMonsterFilters);
    document.getElementById('wave-filter').addEventListener('change', applyMonsterFilters);
    document.getElementById('hp-filter').addEventListener('change', applyMonsterFilters);
    document.getElementById('player-count-filter').addEventListener('change', applyMonsterFilters);
    document.getElementById('hide-img-monsters').addEventListener('change', applyMonsterFilters);
    document.getElementById('battle-limit-alarm').addEventListener('change', (e) => {
      const soundCheckbox = document.getElementById('battle-limit-alarm-sound');
      if (e.target.checked) {
        soundCheckbox.checked = true;
        soundCheckbox.disabled = false;
      } else {
        soundCheckbox.checked = false;
        soundCheckbox.disabled = true;
      }
      applyMonsterFilters();
    });
    
    document.getElementById('battle-limit-alarm-sound').addEventListener('change', applyMonsterFilters);
    
    // Volume control
    const volumeSlider = document.getElementById('battle-limit-alarm-volume');
    const volumeDisplay = document.getElementById('battle-limit-alarm-volume-display');
    if (volumeSlider && volumeDisplay) {
      volumeSlider.addEventListener('input', (e) => {
        volumeDisplay.textContent = e.target.value + '%';
        applyMonsterFilters();
      });
    }
    document.getElementById('clear-filters').addEventListener('click', clearAllFilters);
    
    // Monster type dropdown functionality
    const monsterTypeToggle = document.getElementById('monster-type-toggle');
    const monsterTypeDropdown = document.getElementById('monster-type-dropdown');
    
    monsterTypeToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      monsterTypeDropdown.style.display = monsterTypeDropdown.style.display === 'none' ? 'block' : 'none';
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      monsterTypeDropdown.style.display = 'none';
    });
    
    // Monster type checkbox listeners
    document.querySelectorAll('.monster-type-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', applyMonsterFilters);
    });
    
    // Select all and clear buttons for monster types
    document.getElementById('select-all-monsters').addEventListener('click', () => {
      document.querySelectorAll('.monster-type-checkbox').forEach(checkbox => {
        checkbox.checked = true;
      });
      applyMonsterFilters();
    });
    
    document.getElementById('clear-monsters').addEventListener('click', () => {
      document.querySelectorAll('.monster-type-checkbox').forEach(checkbox => {
        checkbox.checked = false;
      });
      applyMonsterFilters();
    });

    // Initialize filter values from settings
    if (settings.nameFilter) document.getElementById('monster-name-filter').value = settings.nameFilter;
    if (settings.waveFilter) document.getElementById('wave-filter').value = settings.waveFilter;
    if (settings.hpFilter) document.getElementById('hp-filter').value = settings.hpFilter;
    if (settings.playerCountFilter) document.getElementById('player-count-filter').value = settings.playerCountFilter;
    if (settings.hideImg) document.getElementById('hide-img-monsters').checked = settings.hideImg;
    if (settings.battleLimitAlarm) {
      document.getElementById('battle-limit-alarm').checked = settings.battleLimitAlarm;
      const soundCheckbox = document.getElementById('battle-limit-alarm-sound');
      if (settings.battleLimitAlarmSound !== undefined) {
        soundCheckbox.checked = settings.battleLimitAlarmSound;
      }
      soundCheckbox.disabled = !settings.battleLimitAlarm;
      
      // Set volume
      const volumeSlider = document.getElementById('battle-limit-alarm-volume');
      const volumeDisplay = document.getElementById('battle-limit-alarm-volume-display');
      if (volumeSlider && volumeDisplay) {
        const volume = settings.battleLimitAlarmVolume || 70;
        volumeSlider.value = volume;
        volumeDisplay.textContent = volume + '%';
      }
    }

    // Initialize monster type checkboxes
    if (settings.monsterTypeFilter && Array.isArray(settings.monsterTypeFilter)) {
      settings.monsterTypeFilter.forEach(monsterType => {
        const checkbox = document.querySelector(`.monster-type-checkbox[value="${monsterType}"]`);
        if (checkbox) checkbox.checked = true;
      });
    }

    // Apply filters if any are set
    if (settings.nameFilter || (settings.monsterTypeFilter && settings.monsterTypeFilter.length > 0) || settings.waveFilter || settings.hpFilter || settings.playerCountFilter || settings.hideImg || settings.battleLimitAlarm) {
      applyMonsterFilters();
    }
  }

  function applyMonsterFilters() {
    const nameFilter = document.getElementById('monster-name-filter').value.toLowerCase();
    const waveFilter = document.getElementById('wave-filter').value;
    const hpFilter = document.getElementById('hp-filter').value;
    const playerCountFilter = document.getElementById('player-count-filter').value;
    const hideImg = document.getElementById('hide-img-monsters').checked;
    const battleLimitAlarm = document.getElementById('battle-limit-alarm').checked;
    const battleLimitAlarmSound = document.getElementById('battle-limit-alarm-sound').checked;
    const battleLimitAlarmVolume = parseInt(document.getElementById('battle-limit-alarm-volume').value, 10);

    // Get selected monster types
    const selectedMonsterTypes = Array.from(document.querySelectorAll('.monster-type-checkbox:checked')).map(cb => cb.value);
    
    // Update monster type button text
    const monsterTypeToggle = document.getElementById('monster-type-toggle');
    if (selectedMonsterTypes.length === 0) {
      monsterTypeToggle.textContent = 'Monster Types ▼';
    } else if (selectedMonsterTypes.length === 1) {
      monsterTypeToggle.textContent = `${selectedMonsterTypes[0]} ▼`;
    } else {
      monsterTypeToggle.textContent = `${selectedMonsterTypes.length} Types ▼`;
    }

    if (battleLimitAlarm) {
      alarmInterval = setInterval(() => {
        location.reload();
      }, 5000);
    } else {
      clearInterval(alarmInterval);
    }

    const monsters = document.querySelectorAll('.monster-card');
    var limitBattleCount = 0;

    monsters.forEach(monster => {
      const monsterName = monster.querySelector('h3').textContent.toLowerCase();
      const monsterImg = monster.querySelector('img');
      
      // Get HP information
      const hpText = monster.querySelector('.hp-bar')?.nextElementSibling?.textContent || '';
      const hpMatch = hpText.match(/❤️\s*([\d,]+)\s*\/\s*([\d,]+)\s*HP/);
      const currentHp = hpMatch ? parseInt(hpMatch[1].replace(/,/g, '')) : 0;
      const maxHp = hpMatch ? parseInt(hpMatch[2].replace(/,/g, '')) : 1;
      const hpPercentage = maxHp > 0 ? (currentHp / maxHp) * 100 : 0;
      
      // Get player count information
      const playerText = monster.textContent;
      const playerMatch = playerText.match(/👥 Players Joined (\d+)\/30/);
      const playerCount = playerMatch ? parseInt(playerMatch[1]) : 0;

      // Determine monster wave based on name
      const monsterWave = getMonsterWave(monsterName);

      // Apply all filters
      let shouldShow = true;

      // Name filter
      if (nameFilter && !monsterName.includes(nameFilter)) {
        shouldShow = false;
      }

      // Wave filter
      if (waveFilter) {
        if (waveFilter === 'wave1' && monsterWave !== 1) {
          shouldShow = false;
        } else if (waveFilter === 'wave2' && monsterWave !== 2) {
          shouldShow = false;
        }
      }

      // Monster type filter (multiple selection)
      if (selectedMonsterTypes.length > 0) {
        const matchesType = selectedMonsterTypes.some(type => 
          monsterName.includes(type.toLowerCase())
        );
        if (!matchesType) {
          shouldShow = false;
        }
      }

      // HP filter
      if (hpFilter) {
        switch (hpFilter) {
          case 'low':
            if (hpPercentage >= 50) shouldShow = false;
            break;
          case 'medium':
            if (hpPercentage < 50 || hpPercentage > 80) shouldShow = false;
            break;
          case 'high':
            if (hpPercentage <= 80) shouldShow = false;
            break;
          case 'full':
            if (hpPercentage < 100) shouldShow = false;
            break;
        }
      }

      // Player count filter
      if (playerCountFilter) {
        switch (playerCountFilter) {
          case 'empty':
            if (playerCount > 0) shouldShow = false;
            break;
          case 'few':
            if (playerCount >= 10) shouldShow = false;
            break;
          case 'many':
            if (playerCount <= 20) shouldShow = false;
            break;
          case 'full':
            if (playerCount < 30) shouldShow = false;
            break;
        }
      }

      // Apply visibility
      monster.style.display = shouldShow ? '' : 'none';

      // Handle image visibility
      if (hideImg && monsterImg) {
        monsterImg.style.display = 'none';
      } else if (monsterImg) {
        monsterImg.style.removeProperty('display');
      }

      // Count battles for alarm
      if (monster.innerText.includes('Continue the Battle')) {
        limitBattleCount++;
      }
    });

    if (battleLimitAlarm && limitBattleCount < 3) {
      showNotification('🔔 Battle limit alarm: Less than 3 battles!', 'success');
      
      // Play alarm sound if enabled
      if (battleLimitAlarmSound) {
        playAlarmSound();
      }
    }

    // Save all filter settings
    const settings = {
      nameFilter: document.getElementById('monster-name-filter').value,
      monsterTypeFilter: selectedMonsterTypes,
      waveFilter: document.getElementById('wave-filter').value,
      hpFilter: document.getElementById('hp-filter').value,
      playerCountFilter: document.getElementById('player-count-filter').value,
      hideImg: document.getElementById('hide-img-monsters').checked,
      battleLimitAlarm: document.getElementById('battle-limit-alarm').checked,
      battleLimitAlarmSound: document.getElementById('battle-limit-alarm-sound').checked,
      battleLimitAlarmVolume: parseInt(document.getElementById('battle-limit-alarm-volume').value, 10)
    };
    localStorage.setItem('demonGameFilterSettings', JSON.stringify(settings));
  }

  // Play alarm sound function
  function playAlarmSound() {
    try {
      const audio = new Audio(chrome.runtime.getURL('alarm.mp3'));
      const volumeSlider = document.getElementById('battle-limit-alarm-volume');
      const volume = volumeSlider ? parseInt(volumeSlider.value, 10) / 100 : 0.7;
      audio.volume = volume;
      audio.play().catch(error => {
        console.log('Could not play alarm sound:', error);
        // Fallback: use browser's built-in notification sound
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Battle Limit Alarm', {
            body: 'Less than 3 battles available!',
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🔔</text></svg>'
          });
        }
      });
    } catch (error) {
      console.log('Error creating alarm sound:', error);
    }
  }

  function getMonsterWave(monsterName) {
    // Wave 1 monsters
    const wave1Monsters = [
      'orc grunt', 'orc bonecrusher', 'hobogoblin spearman', 
      'goblin slinger', 'goblin skirmisher'
    ];
    
    // Wave 2 monsters
    const wave2Monsters = [
      'lizardman shadowclaw', 'troll brawler', 
      'lizardman flamecaster', 'troll ravager'
    ];
    
    if (wave1Monsters.some(monster => monsterName.includes(monster))) {
      return 1;
    } else if (wave2Monsters.some(monster => monsterName.includes(monster))) {
      return 2;
    }
    
    return 0; // Unknown wave
  }

  function clearAllFilters() {
    document.getElementById('monster-name-filter').value = '';
    document.getElementById('wave-filter').value = '';
    document.getElementById('hp-filter').value = '';
    document.getElementById('player-count-filter').value = '';
    document.getElementById('hide-img-monsters').checked = false;
    document.getElementById('battle-limit-alarm').checked = false;
    document.getElementById('battle-limit-alarm-sound').checked = true;
    document.getElementById('battle-limit-alarm-sound').disabled = true;
    document.getElementById('battle-limit-alarm-volume').value = 70;
    document.getElementById('battle-limit-alarm-volume-display').textContent = '70%';
    
    // Clear all monster type checkboxes
    document.querySelectorAll('.monster-type-checkbox').forEach(checkbox => {
      checkbox.checked = false;
    });
    
    applyMonsterFilters();
    showNotification('All filters cleared!', 'info');
  }
  //#endregion

  //#region Loot and battle functionality
  async function loadInstaLoot(){
    if (!document.getElementById('lootModal')) {
      var modal = document.createElement('div');
      modal.innerHTML = `<div id="lootModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; align-items:center; justify-content:center;">
      <div style="background:#2a2a3d; border-radius:12px; padding:20px; max-width:90%; width:400px; text-align:center; color:white; overflow-y:auto; max-height:80%;">
          <h2 style="margin-bottom:15px;">🎁 Loot Gained</h2>
          <div id="lootItems" style="display:flex; flex-wrap:wrap; justify-content:center; gap:10px;"></div>
          <br>
          <button class="join-btn" onclick="document.getElementById('lootModal').style.display='none'" style="margin-top:10px;">Close</button>
      </div>
  </div>`;

      var notif = document.createElement('div');
      notif.style = `position: fixed; top: 90px; right: 20; background: #2ecc71;color: white;padding: 12px 20px;border-radius: 10px;box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);font-size: 15px;display: none;z-index: 9999;`;
      notif.id = "notification";

      const contentArea = document.querySelector('.content-area');
      if (contentArea) {
        contentArea.appendChild(modal.firstElementChild);
        contentArea.appendChild(notif);
      }

      document.getElementById('lootModal').addEventListener('click', function(event) {
        this.style.display = 'none';
      });
    }

    document.querySelectorAll('.monster-card > a').forEach(x => {
      if (x.innerText.includes('Loot')) {
        var instaBtn = document.createElement('button');
        instaBtn.onclick = function() {
          lootWave(x.href.split("id=")[1]);
        };
        instaBtn.className = "join-btn";
        instaBtn.innerText = "💰 Loot Instantly";
        instaBtn.style.marginTop = "8px";
        x.parentNode.append(instaBtn);
      }
    });
  }

  function joinWaveInstant(monsterId, originalLink) {
    showNotification('Joining battle...', 'success');

    fetch('user_join_battle.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'monster_id=' + monsterId + '&user_id=' + userId,
      referrer: 'https://demonicscans.org/battle.php?id=' + monsterId
    })
    .then(res => res.text())
    .then(data => {
      const msg = (data || '').trim();
      const ok = msg.toLowerCase().startsWith('you have successfully');
      showNotification(msg || 'Unknown response', ok ? 'success' : 'error');
      if (ok) {
        setTimeout(() => {
          window.location.href = originalLink.href;
        }, 1000);
      }
    })
    .catch(() => showNotification('Server error. Please try again.', 'error'));
  }

  function lootWave(monsterId) {
    fetch('loot.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'monster_id=' + monsterId + '&user_id=' + userId
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            const lootContainer = document.getElementById('lootItems');
            lootContainer.innerHTML = '';

            data.items.forEach(item => {
                const div = document.createElement('div');
                div.style = 'background:#1e1e2f; border-radius:8px; padding:10px; text-align:center; width:80px;';
                div.innerHTML = `
                    <img src="${item.IMAGE_URL}" alt="${item.NAME}" style="width:64px; height:64px;"><br>
                    <small>${item.NAME}</small>
                `;
                lootContainer.appendChild(div);
            });

            document.getElementById('lootModal').style.display = 'flex';
        } else {
            showNotification(data.message || 'Failed to loot.', 'error');
        }
    })
    .catch(() => showNotification("Server error", 'error'));
  }

  function showNotification(msg, type = 'success') {
    const note = document.getElementById('notification');
    if (note) {
      // Add emojis to enhance messages
      let emoji = '';
      if (type === 'success') emoji = '✅ ';
      else if (type === 'error') emoji = '❌ ';
      else if (type === 'warning') emoji = '⚠️ ';
      else if (type === 'info') emoji = 'ℹ️ ';
      
      note.innerHTML = emoji + msg;
      
      // Enhanced styling
      if (type === 'error') {
        note.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
        note.style.borderLeft = '4px solid #c0392b';
      } else if (type === 'warning') {
        note.style.background = 'linear-gradient(135deg, #f39c12, #e67e22)';
        note.style.borderLeft = '4px solid #e67e22';
      } else if (type === 'info') {
        note.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
        note.style.borderLeft = '4px solid #2980b9';
      } else {
        note.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
        note.style.borderLeft = '4px solid #27ae60';
      }
      
      note.style.display = 'block';
      note.style.borderRadius = '8px';
      note.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
      
      setTimeout(() => {
          note.style.display = 'none';
      }, 4000); // Slightly longer display time
    }
  }
  //#endregion

  function initGateCollapse() {
    const gateInfo = document.querySelector('.gate-info');
    if (!gateInfo) return;

    const header = gateInfo.querySelector('.gate-info-header');
    const scrollContent = gateInfo.querySelector('.gate-info-scroll');

    if (!header || !scrollContent) return;

    header.classList.add('collapsible-header');
    scrollContent.classList.add('collapsible-content');
    scrollContent.classList.toggle('collapsed');

    const style = document.createElement('style');
    style.textContent = `
      .collapsible-header {
        cursor: pointer;
        user-select: none;
      }
      .collapsible-header:hover {
        background: rgba(255, 255, 255, 0.05);
      }
      .collapsible-content.collapsed {
        display: none;
      }
    `;
    document.head.appendChild(style);

    header.addEventListener('click', function() {
      scrollContent.classList.toggle('collapsed');
    });
  }

  function initContinueBattleFirst(){
    const monsterContainer = document.querySelector('.monster-container');
    if (!monsterContainer) return;

    document.querySelectorAll('.monster-card').forEach(x => {
      if (x.innerText.includes('Continue the Battle')) {
        monsterContainer.prepend(x);
      }
    });
  }

  function initImprovedWaveButtons() {
    document.querySelectorAll('.monster-card > a').forEach(battleLink => {
      if (battleLink.innerText.includes('Join the Battle')) {
        const monsterId = battleLink.href.split("id=")[1];

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 8px; margin-top: 8px;';

        const joinBtn = document.createElement('button');
        joinBtn.className = "join-btn";
        joinBtn.style.cssText = 'flex: 1; font-size: 12px;';
        joinBtn.innerText = "⚔️ Join Battle";
        joinBtn.onclick = function() {
          joinWaveInstant(monsterId, battleLink);
        };

        const viewBtn = document.createElement('button');
        viewBtn.className = "join-btn";
        viewBtn.style.cssText = 'flex: 1; font-size: 12px; background: #6c7086;';
        viewBtn.innerText = "👁️ View";
        viewBtn.onclick = function() {
          window.location.href = battleLink.href;
        };

        buttonContainer.appendChild(joinBtn);
        buttonContainer.appendChild(viewBtn);

        battleLink.style.display = 'none';
        battleLink.parentNode.appendChild(buttonContainer);
      }
    });
  }

  // Enhanced Monster sorting functionality with collapsible sections
  function initMonsterSorting() {
    const monsterContainer = document.querySelector('.monster-container');
    if (!monsterContainer) return;

    const continueBattleSection = document.createElement('div');
    continueBattleSection.className = 'monster-section';
    continueBattleSection.innerHTML = `
      <div class="monster-section-header">
        <h3 style="color: #f38ba8; margin: 0; flex: 1;">⚔️ Continue Battle</h3>
        <button class="section-toggle-btn" id="continue-battle-toggle">${extensionSettings.continueBattlesExpanded ? '–' : '+'}</button>
      </div>
      <div class="monster-section-content" id="continue-battle-content" style="display: ${extensionSettings.continueBattlesExpanded ? 'block' : 'none'};">
        <div class="monster-container" style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 20px;"></div>
      </div>
    `;

    const lootSection = document.createElement('div');
    lootSection.className = 'monster-section';
    lootSection.innerHTML = `
      <div class="monster-section-header">
        <h3 style="color: #f9e2af; margin: 0; flex: 1;">💰 Available Loot</h3>
        <button class="section-toggle-btn" id="loot-toggle">${extensionSettings.lootExpanded ? '–' : '+'}</button>
      </div>
      <div class="monster-section-content" id="loot-content" style="display: ${extensionSettings.lootExpanded ? 'block' : 'none'};">
        <div class="monster-container" style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 20px;"></div>
      </div>
    `;

    const joinBattleSection = document.createElement('div');
    joinBattleSection.className = 'monster-section';
    joinBattleSection.innerHTML = `
      <div class="monster-section-header">
        <h3 style="color: #a6e3a1; margin: 0; flex: 1;">🆕 Join a Battle</h3>
      </div>
      <div class="monster-section-content">
        <div class="monster-container" style="display: flex; flex-wrap: wrap; gap: 15px;"></div>
      </div>
    `;

    const monsterCards = Array.from(document.querySelectorAll('.monster-card'));
    const continueCards = [];
    const lootCards = [];
    const joinCards = [];

    monsterCards.forEach(card => {
      if (card.innerText.includes('Continue the Battle')) {
        continueCards.push(card);
      } else if (card.innerText.includes('Loot')) {
        lootCards.push(card);
      } else {
        const hpText = card.querySelector('div[style*="width:"]')?.parentNode?.nextElementSibling?.textContent || '';
        const hpMatch = hpText.match(/❤️\s*([\d,]+)\s*\/\s*([\d,]+)\s*HP/);
        if (hpMatch) {
          const currentHp = parseInt(hpMatch[1].replace(/,/g, ''));
          card.dataset.currentHp = currentHp;
        }
        joinCards.push(card);
      }
    });

    joinCards.sort((a, b) => {
      const hpA = parseInt(a.dataset.currentHp) || 0;
      const hpB = parseInt(b.dataset.currentHp) || 0;
      return hpA - hpB;
    });

    monsterContainer.innerHTML = '';

    if (continueCards.length > 0) {
      const continueGrid = continueBattleSection.querySelector('.monster-container');
      continueCards.forEach(card => continueGrid.appendChild(card));
      monsterContainer.appendChild(continueBattleSection);
    }

    if (lootCards.length > 0) {
      // Update the loot section header with count
      const lootHeader = lootSection.querySelector('h3');
      lootHeader.textContent = `💰 Available Loot (${lootCards.length})`;
      
      const lootGrid = lootSection.querySelector('.monster-container');
      lootCards.forEach(card => lootGrid.appendChild(card));
      monsterContainer.appendChild(lootSection);
    }

    if (joinCards.length > 0) {
      const joinGrid = joinBattleSection.querySelector('.monster-container');
      joinCards.forEach(card => joinGrid.appendChild(card));
      monsterContainer.appendChild(joinBattleSection);
    }

    const continueToggle = document.getElementById('continue-battle-toggle');
    const lootToggle = document.getElementById('loot-toggle');
    const continueContent = document.getElementById('continue-battle-content');
    const lootContent = document.getElementById('loot-content');

    if (continueToggle && continueContent) {
      continueToggle.addEventListener('click', () => {
        const isCollapsed = continueContent.style.display === 'none';
        continueContent.style.display = isCollapsed ? 'block' : 'none';
        continueToggle.textContent = isCollapsed ? '–' : '+';
        extensionSettings.continueBattlesExpanded = isCollapsed;
        saveSettings();
      });
    }

    if (lootToggle && lootContent) {
      lootToggle.addEventListener('click', () => {
        const isCollapsed = lootContent.style.display === 'none';
        lootContent.style.display = isCollapsed ? 'block' : 'none';
        lootToggle.textContent = isCollapsed ? '–' : '+';
        extensionSettings.lootExpanded = isCollapsed;
        saveSettings();
      });
    }

    const sectionStyle = document.createElement('style');
    sectionStyle.textContent = `
      .monster-section {
        margin-bottom: 30px;
        background: rgba(30, 30, 46, 0.3);
        border-radius: 8px;
        overflow: hidden;
      }

      .monster-section-header {
        display: flex;
        align-items: center;
        padding: 15px 20px;
        background: rgba(203, 166, 247, 0.1);
        cursor: pointer;
        border-bottom: 1px solid rgba(88, 91, 112, 0.3);
      }

      .monster-section-header:hover {
        background: rgba(203, 166, 247, 0.15);
      }

      .section-toggle-btn {
        background: none;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #e0e0e0;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        min-width: 24px;
      }

      .section-toggle-btn:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .monster-section-content {
        padding: 15px 20px;
      }
    `;
    document.head.appendChild(sectionStyle);
  }

  // Additional battle and other functionality...
  function initReducedImageSize(){
    const monsterImage = document.getElementById('monsterImage');
    const panel = document.querySelector('.content-area > .panel');
    const hpBar = document.querySelector('.hp-bar');

    if (monsterImage) {
      monsterImage.style.maxHeight = "400px";
    }
    if (panel) {
      panel.style.justifyItems = "center";
      panel.style.textAlign = "center";
    }
    if (hpBar) {
      hpBar.style.justifySelf = "normal";
    }
  }

  function initTotalOwnDamage(){
    colorMyself();
    const observer = new MutationObserver((mutations) => {
      const shouldUpdate = mutations.some(mutation =>
        mutation.type === 'childList' && mutation.addedNodes.length > 0
      );

      if (shouldUpdate) {
        setTimeout(colorMyself, 50);
      }
    });

    const config = {
      childList: true,
      subtree: true
    };

    const targetElement = document.querySelector('.leaderboard-panel');
    if (targetElement) {
      observer.observe(targetElement, config);
    }
  }

  function colorMyself(){
    document.querySelectorAll('.lb-row a').forEach(x => {
      if (x.href.includes(userId)) {
        var lbrow = x.parentElement.parentElement;
        var exDamageDone = lbrow.querySelector('.lb-dmg').innerText;
        var exDamageNumber = Number.parseInt(exDamageDone.replaceAll(',','').replaceAll('.',''));

        lbrow.style.backgroundColor = '#7a2020';

        document.querySelectorAll("div.stats-stack > span").forEach(x => {
          if (x.innerText.includes('Your Damage: ')) {
            x.innerText = "Your Damage: " + exDamageDone;
          }
        });

        var lootContainer = document.createElement('div');
        lootContainer.id = 'extension-loot-container';

        document.querySelectorAll('.loot-card').forEach(x => lootContainer.append(x));

        var enemyAndLootContainer = document.createElement('div');
        enemyAndLootContainer.id = 'extension-enemy-loot-container';

        const scopedStyle = document.createElement('style')
        scopedStyle.textContent=  `.panel:has(.loot-grid) {display: none;}`

        enemyAndLootContainer.prepend(scopedStyle)

        const monsterImage = document.querySelector('.monster_image');
        if (monsterImage) {
          enemyAndLootContainer.append(monsterImage);
        }
        enemyAndLootContainer.append(lootContainer);

        const panel = document.querySelector("body > div.main-wrapper > div > .panel");
        if (panel) {
          panel.prepend(enemyAndLootContainer);
        }

        document.querySelectorAll('.loot-card').forEach(y => {
          y.style.margin = '5px';
          y.querySelectorAll('.loot-stats .chip').forEach(x => {
            if (x.parentElement) {
              x.parentElement.style.gap = '0px';
            }
            if (x.innerText.includes('DMG req')) {
              var lootReqNumber = Number.parseInt(x.innerText.substr(9).replaceAll(',','').replaceAll('.',''));
              if (lootReqNumber <= exDamageNumber) {
                y.style.background = 'rgb(0 255 30 / 20%)';
                y.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.6)';
                try {
                  y.classList.remove('locked');
                  const lockBadge = y.querySelector('.lock-badge');
                  if (lockBadge) {
                    lockBadge.remove();
                  }
                } catch {}
              }
            }
          });
        });
      }
    });
  }

  function initAnyClickClosesModal(){
    const lootModal = document.getElementById('lootModal');
    if (lootModal) {
      lootModal.addEventListener('click', function(event) {
        this.style.display = 'none';
      });
    }
  }

  // Stat allocation functions
  function allocateStatPoints(stat, amount) {
    const currentPoints = parseInt(document.getElementById('v-points')?.textContent || '0');
    if (currentPoints < amount) {
      showNotification('Not enough stat points!', 'error');
      return;
    }

    const body = `action=allocate&stat=${encodeURIComponent(stat)}&amount=${encodeURIComponent(amount)}`;
    fetch('stats_ajax.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    })
    .then(async r => {
      const txt = await r.text();
      try {
        return { okHTTP: r.ok, json: JSON.parse(txt), raw: txt };
      } catch {
        throw new Error(`Bad JSON (${r.status}): ${txt}`);
      }
    })
    .then(pack => {
      if (!pack.okHTTP) {
        showNotification(`HTTP ${pack.raw}`, 'error');
        return;
      }
      const res = pack.json;
      if (!res.ok) {
        showNotification(res.msg || 'Error', 'error');
        return;
      }

      const u = res.user;
      document.getElementById('v-points').textContent = u.STAT_POINTS;
      document.getElementById('v-attack').textContent = u.ATTACK;
      document.getElementById('v-defense').textContent = u.DEFENSE;
      document.getElementById('v-stamina').textContent = u.STAMINA;

      updateSidebarStats(u);
      showNotification(`Allocated ${amount} points to ${stat}!`, 'success');

      setTimeout(() => {
        const statSection = document.querySelector('#stat-allocation-content');
        if (statSection) {
          initStatAllocation();
        }
      }, 500);
    })
    .catch(error => {
      showNotification('Failed to allocate stats', 'error');
      console.error('Error:', error);
    });
  }

  function sidebarAlloc(stat, amount) {
      const pointsElement = document.getElementById('sidebar-points');
      const currentPoints = parseInt(pointsElement?.textContent || '0');

      if (currentPoints < amount) {
          showNotification(`Not enough points! You need ${amount} points but only have ${currentPoints}.`, 'error');
          return;
      }

      // Map our stat names to what the server expects
      const statMapping = {
          'attack': 'attack',
          'defense': 'defense', 
          'stamina': 'stamina'
      };

      const serverStat = statMapping[stat] || stat;
      const body = `action=allocate&stat=${encodeURIComponent(serverStat)}&amount=${encodeURIComponent(amount)}`;

      // Disable all upgrade buttons temporarily
      document.querySelectorAll('.upgrade-btn').forEach(btn => btn.disabled = true);

      fetch('stats_ajax.php', {
          method: 'POST',
          headers: {'Content-Type': 'application/x-www-form-urlencoded'},
          body
      })
      .then(async r => {
          const txt = await r.text();
          try {
              const json = JSON.parse(txt);
              if (json.error) {
                  throw new Error(json.error);
              }
              return { okHTTP: r.ok, json, raw: txt };
          } catch (parseError) {
              // If not JSON or has error, try to parse as plain text
              if (r.ok && txt.includes('STAT_POINTS')) {
                  const stats = {};
                  const lines = txt.split('\n');
                  lines.forEach(line => {
                      if (line.includes('STAT_POINTS')) stats.STAT_POINTS = line.split('=')[1]?.trim();
                      if (line.includes('ATTACK')) stats.ATTACK = line.split('=')[1]?.trim();
                      if (line.includes('DEFENSE')) stats.DEFENSE = line.split('=')[1]?.trim();
                      if (line.includes('STAMINA')) stats.STAMINA = line.split('=')[1]?.trim();
                  });
                  return { okHTTP: r.ok, json: { ok: true, user: stats }, raw: txt };
              }
              throw new Error(`Bad response (${r.status}): ${txt}`);
          }
      })
      .then(pack => {
          if (!pack.okHTTP) {
              showNotification(`HTTP Error: ${pack.raw}`, 'error');
              return;
          }

          const res = pack.json;
          if (!res.ok) {
              showNotification(res.msg || res.error || 'Allocation failed', 'error');
              return;
          }

          const u = res.user;
          updateSidebarStats(u);

          // Also update main stats page if we're on it
          if (window.location.pathname.includes('stats')) {
              const mainPoints = document.getElementById('v-points');
              const mainAttack = document.getElementById('v-attack');
              const mainDefense = document.getElementById('v-defense');
              const mainStamina = document.getElementById('v-stamina');

              if (mainPoints) mainPoints.textContent = u.STAT_POINTS || u.stat_points || 0;
              if (mainAttack) mainAttack.textContent = u.ATTACK || u.attack || 0;
              if (mainDefense) mainDefense.textContent = u.DEFENSE || u.defense || 0;
              if (mainStamina) mainStamina.textContent = u.STAMINA || u.MAX_STAMINA || u.stamina || 0;
          }

          showNotification(`Successfully upgraded ${stat} by ${amount}!`, 'success');
      })
      .catch(err => {
          console.error(err);
          showNotification(err.message || 'Network error occurred', 'error');
      })
      .finally(() => {
          // Re-enable upgrade buttons
          document.querySelectorAll('.upgrade-btn').forEach(btn => btn.disabled = false);
          // Refresh stats after allocation
          setTimeout(fetchAndUpdateSidebarStats, 500);
      });
  }

  // Page initialization functions
  function initWaveMods() {
    initGateCollapse()
    initMonsterFilter()
    loadInstaLoot()
    initContinueBattleFirst()
    initImprovedWaveButtons()
    initMonsterSorting()
  }

  function initPvPMods(){
    initPvPBannerFix()
    createPvPAutomationButton()
    initPvPAutomation() // Also initialize on pvp.php
  }

  function createPvPAutomationButton() {
    const heroRow = document.querySelector('.hero-row');
    const btnStartTop = document.getElementById('btnStartTop');
    
    if (heroRow && btnStartTop && !document.getElementById('btnAutomationPvp')) {
      const automationBtn = document.createElement('button');
      automationBtn.id = 'btnAutomationPvp';
      automationBtn.className = 'hero-btn';
      automationBtn.title = 'PvP Automation';
      automationBtn.draggable = false;
      automationBtn.textContent = 'Automate PvP';
      
      automationBtn.addEventListener('click', togglePvPAutomation);
      
      btnStartTop.insertAdjacentElement('afterend', automationBtn);
      updatePvPHeroButtonState();
    }
  }

  function updatePvPHeroButtonState() {
    const btn = document.getElementById('btnAutomationPvp');
    if (!btn) return;
    
    const isRunning = getPvPAutomation();
    const coinsEl = document.querySelector('#pvp-coins');
    const coins = coinsEl ? parseInt(coinsEl.textContent) : 1;
    
    if (coins === 0 && !isRunning) {
      btn.disabled = true;
      btn.style.cursor = 'not-allowed';
      btn.textContent = 'No PvP Coins';
    } else {
      btn.disabled = false;
      btn.style.cursor = 'pointer';
      btn.textContent = isRunning ? 'Stop PvP' : 'Automate PvP';
      btn.style.background = isRunning ? '#f38ba8' : '';
    }
  }

  function initPvPBattleMods(){
    initPvPAutomation()
  }

  function initDashboardTools() {
    console.log("Initializing dashboard tools");
  }

  function initBattleMods(){
    initReducedImageSize()
    initTotalOwnDamage()
    initAnyClickClosesModal()
  }

  function initChatMods(){
      const logEl = document.getElementById("chatLog");
      if (logEl) {
        logEl.scrollTop = logEl.scrollHeight;
      }
  }

  function initInventoryMods(){
    initAlternativeInventoryView()
    initItemTotalDmg()
    addInventoryQuickAccessButtons()
  }

  function initMerchantMods() {
    addMerchantQuickAccessButtons()
  }

  function initPetMods(){
    initPetTotalDmg()
    initPetRequiredFood()
    showComingSoon('Pets')
  }

  function initStatMods(){
    initPlayerAtkDamage()
    // Stat allocation moved to sidebar - no longer needed on stats page
  }

  function initBlacksmithMods(){
    showComingSoon('Blacksmith')
  }

  function initEventMods(){
    initRankingSideBySide()
  }



  // PvP Automation System with localStorage state
  // Initialize localStorage if not exists
  if (localStorage.getItem('veyra-pvp-automation') === null) {
    localStorage.setItem('veyra-pvp-automation', 'false');
  }
  if (localStorage.getItem('pvp-auto-surrend') === null) {
    localStorage.setItem('pvp-auto-surrend', 'false');
  }

  var pvpHUD = null;
  var originalAlert = window.alert;
  var originalConfirm = window.confirm;
  var originalPrompt = window.prompt;
  var autoSlashInterval = null;
  var autoSlashEnabled = false;

  // Farming automation variables
  function getFarmingAutomation() {
    return localStorage.getItem('veyra-farming-automation') === 'true';
  }

  function setFarmingAutomation(value) {
    localStorage.setItem('veyra-farming-automation', value.toString());
  }

  // Initialize farming localStorage if not exists
  if (localStorage.getItem('veyra-farming-automation') === null) {
    localStorage.setItem('veyra-farming-automation', 'false');
  }
  if (localStorage.getItem('minus-energy-cap') === null) {
    localStorage.setItem('minus-energy-cap', extensionSettings.energyCap.toString());
  }
  if (localStorage.getItem('target-farming-energy') === null) {
    localStorage.setItem('target-farming-energy', extensionSettings.energyTarget.toString());
  }
  if (localStorage.getItem('farming-mode') === null) {
    localStorage.setItem('farming-mode', extensionSettings.farmingMode);
  }

  function getPvPAutomation() {
    return localStorage.getItem('veyra-pvp-automation') === 'true';
  }

  function setPvPAutomation(value) {
    localStorage.setItem('veyra-pvp-automation', value.toString());
  }

  function initPvPAutomationButton() {
    const automationBtn = document.getElementById('btn-automation-pvp');
    if (automationBtn) {
      updatePvPButtonState();
      automationBtn.addEventListener('click', togglePvPAutomation);
    }
  }

  function initFarmingAutomationButton() {
    const farmingBtn = document.getElementById('btn-automation-farming');
    if (farmingBtn) {
      updateFarmingButtonState();
      farmingBtn.addEventListener('click', toggleFarmingAutomation);
    }
  }

  function updateFarmingButtonState() {
    const btn = document.getElementById('btn-automation-farming');
    if (!btn) return;
    
    const isRunning = getFarmingAutomation();
    btn.textContent = isRunning ? '⏹️ Stop Farm' : '🌽 Auto Farm';
    btn.style.background = isRunning ? '#f38ba8' : '#74c0fc';
  }

  function toggleFarmingAutomation() {
    const newRunningState = !getFarmingAutomation();
    setFarmingAutomation(newRunningState);
    updateFarmingButtonState();
    
    if (newRunningState) {
      showNotification('Starting farming automation...', 'success');
      window.open('https://demonicscans.org/', '_blank');
    } else {
      showNotification('Farming automation stopped', 'info');
    }
  }

  function toggleFarmingAutomationHUD() {
    const newRunningState = !getFarmingAutomation();
    setFarmingAutomation(newRunningState);
    updateFarmingHUD();
    
    if (newRunningState) {
      showNotification('Starting farming automation...', 'success');
      window.location.href = 'https://demonicscans.org/';
    } else {
      showNotification('Farming automation stopped', 'info');
    }
  }

  function updatePvPButtonState() {
    const btn = document.getElementById('btn-automation-pvp');
    if (!btn) return;
    
    const isRunning = getPvPAutomation();
    btn.textContent = isRunning ? '⏹️ Stop PvP' : '🤖 PvP Auto';
    btn.style.background = isRunning ? '#f38ba8' : '#74c0fc';
    
    // Also update hero button if it exists
    updatePvPHeroButtonState();
  }

  function togglePvPAutomation() {
    const newRunningState = !getPvPAutomation();
    setPvPAutomation(newRunningState);
    updatePvPButtonState();
    
    if (newRunningState) {
      // If not on PvP page, redirect to pvp.php and start automation
      if (!window.location.pathname.includes('pvp.php') && !window.location.pathname.includes('pvp_battle.php')) {
        showNotification('Redirecting to PvP page...', 'info');
        window.location.href = 'pvp.php';
        return;
      }
      
      // Override dialogs when starting automation
      if (window.location.pathname.includes('pvp_battle.php')) {
        window.alert = () => true;
        window.confirm = () => true;
        window.prompt = () => true;
      }
      startPvPAutomation();
    } else {
      // Restore dialogs when stopping
      if (window.location.pathname.includes('pvp_battle.php')) {
        window.alert = originalAlert;
        window.confirm = originalConfirm;
        window.prompt = originalPrompt;
      }
      stopPvPAutomation();
    }
  }

  function createPvPBattleHUD() {
    const myHpText = document.getElementById('myHpText');
    if (!myHpText || document.getElementById('pvp-hud')) return;
    
    const hudDiv = document.createElement('div');
    hudDiv.id = 'pvp-hud';
    hudDiv.innerHTML = `
      <div style="border-bottom: 1px solid; margin: 8px 0;"></div>
      <div>
        <div>⚔️ Enemy Damage: <span id="pvp-stats-enemy-damage">0</span></div>
        <div style="margin-bottom: 10px">⚔️ Your Damage: <span id="pvp-stats-your-damage">0</span></div> 
        <div class="pvp-chip" id="pvp-prediction">Waiting Attack</div>
      </div>
      <div style="border-bottom: 1px solid; margin: 8px 0;"></div>
    `;
    
    myHpText.insertAdjacentElement('afterend', hudDiv);
  }

  function createPvPStopButton() {
    const attackBtnWrap = document.querySelector('.attack-btn-wrap');
    if (!attackBtnWrap || document.getElementById('pvp-stop-btn')) return;
    
    const stopBtn = document.createElement('button');
    stopBtn.id = 'pvp-stop-btn';
    stopBtn.style.cssText = `
      background: linear-gradient(180deg, #74c0fc, #5aa3e0);
      border: 1px solid #88ccffff;
      color: white;
      padding: 10px 14px;
      border-radius: 12px;
      cursor: pointer;
      box-shadow: 0 8px 18px rgb(238 59 125 / 28%);
      min-width: 140px;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: .2px;
      line-height: 1rem;
    `;
    
    stopBtn.addEventListener('click', handlePvPStopButtonClick);
    
    attackBtnWrap.appendChild(stopBtn);
    updatePvPStopButtonState();
  }

  function updatePvPStopButtonState() {
    const stopBtn = document.getElementById('pvp-stop-btn');
    const surrenderCheckbox = document.getElementById('pvp-auto-surrender');
    if (!stopBtn) return;
    
    const isPvPRunning = getPvPAutomation();
    
    if (isPvPRunning) {
      stopBtn.textContent = '⏹️ Stop Auto';
      stopBtn.style.background = 'linear-gradient(180deg, #eb4582, #d33855)';
      stopBtn.style.border = '1px solid #ef6095';
      if (surrenderCheckbox) surrenderCheckbox.parentElement.parentElement.style.display = 'block';
    } else if (autoSlashEnabled) {
      stopBtn.textContent = '⏹️ Stop Slash';
      stopBtn.style.background = 'linear-gradient(180deg, #eb4582, #d33855)';
      stopBtn.style.border = '1px solid #ef6095';
      if (surrenderCheckbox) surrenderCheckbox.parentElement.parentElement.style.display = 'none';
    } else {
      stopBtn.textContent = '⚔️ Start AutoSlash';
      stopBtn.style.background = 'linear-gradient(180deg, #74c0fc, #5aa3e0)';
      stopBtn.style.border = '1px solid #88ccffff';
      if (surrenderCheckbox) surrenderCheckbox.parentElement.parentElement.style.display = 'none';
    }
  }

  function handlePvPStopButtonClick() {
    const isPvPRunning = getPvPAutomation();
    
    if (isPvPRunning) {
      // Stop full PvP automation
      setPvPAutomation(false);
      updatePvPButtonState();
      updatePvPStopButtonState();
      showNotification('PvP automation stopped', 'info');
    } else if (autoSlashEnabled) {
      // Stop autoslash
      stopAutoSlash();
      updatePvPStopButtonState();
      showNotification('AutoSlash stopped', 'info');
    } else {
      // Start autoslash
      startAutoSlash();
      updatePvPStopButtonState();
      showNotification('AutoSlash started', 'success');
    }
  }

  function startAutoSlash() {
    autoSlashEnabled = true;
    autoSlashInterval = setInterval(() => {
      if (!autoSlashEnabled) return;
      
      // Check if enemy HP is 0
      const enemyHealthEl = document.getElementById('enemyHpText');
      if (enemyHealthEl) {
        const enemyHealth = parseInt(enemyHealthEl.textContent.split('/')[0].replace(/[^0-9,.]/g, ''));
        if (enemyHealth <= 0) {
          stopAutoSlash();
          updatePvPStopButtonState();
          showNotification('Enemy defeated - AutoSlash stopped', 'success');
          return;
        }
      }
      
      const attackBtn = document.querySelector('.attack-btn.skill-btn[data-cost="1"]');
      if (attackBtn && attackBtn.offsetParent !== null && !attackBtn.disabled) {
        attackBtn.click();
      }
    }, 1070);
  }

  function stopAutoSlash() {
    autoSlashEnabled = false;
    if (autoSlashInterval) {
      clearInterval(autoSlashInterval);
      autoSlashInterval = null;
    }
  }

  function createAutoSurrenderCheckbox() {
    const surrenderRow = document.querySelector('.surrender-row');
    if (!surrenderRow || document.getElementById('pvp-auto-surrender')) return;
    
    const checkboxDiv = document.createElement('div');
    checkboxDiv.style.cssText = 'margin-top: 10px; text-align: center;';
    checkboxDiv.innerHTML = `
      <label style="color: #cdd6f4; font-size: 14px; cursor: pointer;">
        <input type="checkbox" id="pvp-auto-surrender" ${extensionSettings.autoSurrenderEnabled ? 'checked' : ''}>
        Auto Surrender (when losing)
      </label>
    `;
    
    surrenderRow.appendChild(checkboxDiv);
    
    const checkbox = document.getElementById('pvp-auto-surrender');
    checkbox.addEventListener('change', () => {
      extensionSettings.autoSurrenderEnabled = checkbox.checked;
      saveSettings();
    });
  }

  function readBattleStats() {
    const logItems = document.querySelectorAll('#logWrap .log-item .log-left');
    const enemyDamage = logItems.length > 0 ? logItems[0].querySelector('strong')?.innerText || 0 : 0;
    const yourDamage = logItems.length > 1 ? logItems[1].querySelector('strong')?.innerText || 0 : 0;
    
    window.battleStats = {
      enemyDamage: parseInt(enemyDamage.toString().replace(/,/g, '')) || 0,
      yourDamage: parseInt(yourDamage.toString().replace(/,/g, '')) || 0
    };
  }

  function updatePvPBattleStats() {
    const enemyDamageEl = document.getElementById('pvp-stats-enemy-damage');
    const yourDamageEl = document.getElementById('pvp-stats-your-damage');
    const predictionEl = document.getElementById('pvp-prediction');
    
    if (!enemyDamageEl || !yourDamageEl || !predictionEl) return;
    
    readBattleStats();
    const stats = window.battleStats || { enemyDamage: 0, yourDamage: 0 };
    
    enemyDamageEl.textContent = stats.enemyDamage;
    yourDamageEl.textContent = stats.yourDamage;
    
    if (stats.enemyDamage === 0 || stats.yourDamage === 0) {
      predictionEl.textContent = 'Waiting Attack';
      predictionEl.className = 'pvp-chip';
    } else {
      const enemyHealthEl = document.getElementById('enemyHpText');
      const yourHealthEl = document.getElementById('myHpText');
      
      const enemyMaxHealth = enemyHealthEl ? parseInt(enemyHealthEl.textContent.split('/')[1].replace(/[^0-9,.]/g, '')) : 0;
      const yourMaxHealth = yourHealthEl ? parseInt(yourHealthEl.textContent.split('/')[1].replace(/[^0-9,.]/g, '')) : 0;
      
      const atkNeeded = enemyMaxHealth / stats.yourDamage;
      const enemyAtkNeeded = yourMaxHealth / stats.enemyDamage;
      
      if (enemyAtkNeeded > atkNeeded) {
        predictionEl.textContent = 'You will WIN';
        predictionEl.className = 'pvp-chip success';
      } else {
        predictionEl.textContent = 'You will LOSE';
        predictionEl.className = 'pvp-chip danger';
      }
    }
  }

  function startPvPAutomation() {
    if (!getPvPAutomation()) return;
    
    if (window.location.pathname.includes('pvp.php')) {
      checkCoinsAndBattle();
    } else if (window.location.pathname.includes('pvp_battle.php')) {
      createPvPBattleHUD();
      createPvPStopButton();
      startBattleLoop();
    }
  }

  function stopPvPAutomation() {
    // Stop any running autoslash
    stopAutoSlash();
    
    // Restore original alert functions when stopping
    if (window.location.pathname.includes('pvp_battle.php')) {
      window.alert = originalAlert;
      window.confirm = originalConfirm;
      window.prompt = originalPrompt;
    }
  }

  function checkCoinsAndBattle() {
    if (!getPvPAutomation()) return;
    
    const coinsEl = document.querySelector('#pvp-coins');
    if (!coinsEl) {
      setTimeout(checkCoinsAndBattle, 1000);
      return;
    }
    
    const coins = parseInt(coinsEl.textContent);
    
    if (coins > 0) {
      performSingleBattle().then(() => {
        window.location.href = 'https://demonicscans.org/pvp.php';
      });
    } else {
      showNotification('No more PVP coins available', 'warning');
      setPvPAutomation(false);
      updatePvPButtonState();
    }
  }

  function performSingleBattle() {
    return new Promise((resolve) => {
      const startBtn = document.querySelector('#btnStartTop');
      if (!startBtn) {
        resolve();
        return;
      }
      
      startBtn.click();
      
      const attackLoop = () => {
        if (!getPvPAutomation()) {
          resolve();
          return;
        }
        
        const endBody = document.querySelector('#endBody');
        if (endBody && endBody.textContent.trim() !== '') {
          resolve();
          return;
        }
        
        // Check for auto surrender
        if (extensionSettings.autoSurrenderEnabled) {
          const stats = window.battleStats;
          if (stats && stats.enemyDamage > 0 && stats.yourDamage > 0) {
            const enemyHealthEl = document.getElementById('enemyHpText');
            const yourHealthEl = document.getElementById('myHpText');
            
            const enemyMaxHealth = enemyHealthEl ? parseInt(enemyHealthEl.textContent.split('/')[1].replace(/[^0-9,.]/g, '')) : 0;
            const yourMaxHealth = yourHealthEl ? parseInt(yourHealthEl.textContent.split('/')[1].replace(/[^0-9,.]/g, '')) : 0;
            
            const atkNeeded = enemyMaxHealth / stats.yourDamage;
            const enemyAtkNeeded = yourMaxHealth / stats.enemyDamage;
            
            if (enemyAtkNeeded <= atkNeeded) {
              const surrenderBtn = document.getElementById('btnSurrender');
              if (surrenderBtn) {
                surrenderBtn.click();
                resolve();
                return;
              }
            }
          }
        }
        
        const attackBtn = document.querySelector('.attack-btn.skill-btn[data-cost="1"]');
        if (attackBtn && attackBtn.offsetParent !== null) {
          attackBtn.click();
          setTimeout(() => {
            updatePvPBattleStats();
          }, 500);
        }
        
        setTimeout(attackLoop, 1070);
      };
      
      attackLoop();
    });
  }

  function startBattleLoop() {
    if (!getPvPAutomation()) return;
    
    const endBody = document.querySelector('#endBody');
    if (endBody && endBody.textContent.trim() !== '') {
      setTimeout(() => {
        window.location.href = 'https://demonicscans.org/pvp.php';
      }, 2000);
      return;
    }
    
    // Check for auto surrender
    if (extensionSettings.autoSurrenderEnabled) {
      const stats = window.battleStats;
      if (stats && stats.enemyDamage > 0 && stats.yourDamage > 0) {
        const enemyHealthEl = document.getElementById('enemyHpText');
        const yourHealthEl = document.getElementById('myHpText');
        
        const enemyMaxHealth = enemyHealthEl ? parseInt(enemyHealthEl.textContent.split('/')[1].replace(/[^0-9,.]/g, '')) : 0;
        const yourMaxHealth = yourHealthEl ? parseInt(yourHealthEl.textContent.split('/')[1].replace(/[^0-9,.]/g, '')) : 0;
        
        const atkNeeded = enemyMaxHealth / stats.yourDamage;
        const enemyAtkNeeded = yourMaxHealth / stats.enemyDamage;
        
        if (enemyAtkNeeded <= atkNeeded) {
          const surrenderBtn = document.getElementById('btnSurrender');
          if (surrenderBtn) {
            surrenderBtn.click();
            setTimeout(() => {
              window.location.href = 'https://demonicscans.org/pvp.php';
            }, 2000);
            return;
          }
        }
      }
    }
    
    const attackBtn = document.querySelector('.attack-btn.skill-btn[data-cost="1"]');
    if (attackBtn && attackBtn.offsetParent !== null) {
      attackBtn.click();
      setTimeout(() => {
        updatePvPBattleStats();
      }, 500);
    }
    
    setTimeout(startBattleLoop, 1000);
  }

  function initPvPAutomation() {
    const currentPath = window.location.pathname;
    
    if (currentPath.includes('pvp_battle.php')) {
      // Force override browser dialogs immediately if automation is running
      if (getPvPAutomation()) {
        window.alert = () => true;
        window.confirm = () => true;
        window.prompt = () => true;
      }
      
      createPvPBattleHUD();
      createPvPStopButton();
      createAutoSurrenderCheckbox();
      
      if (getPvPAutomation()) {
        startBattleLoop();
      }
    } else if (currentPath.includes('pvp.php') && getPvPAutomation()) {
      setTimeout(checkCoinsAndBattle, 1000);
    }
  }

  // Farming automation functions
  function createFarmingHUD() {
    // Only create HUD on main site pages (not game pages)
    if (window.location.hostname !== 'demonicscans.org' || 
        window.location.pathname.includes('.php')) return;
    
    if (document.getElementById('farming-hud')) return;
    
    const hud = document.createElement('div');
    hud.id = 'farming-hud';
    hud.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: rgba(0,0,0,0.8);
      color: lime;
      font-size: 14px;
      font-family: monospace;
      padding: 8px 12px;
      border-radius: 8px;
      z-index: 99999;
      line-height: 1.5em;
    `;
    
    document.body.appendChild(hud);
    updateFarmingHUD();
  }

  function updateFarmingHUD() {
    const hud = document.getElementById('farming-hud');
    if (!hud) return;
    
    const isRunning = getFarmingAutomation();
    hud.style.color = isRunning ? 'lime' : 'yellow';
    
    if (window.location.pathname.includes('/title/') && window.location.pathname.includes('/chapter/')) {
      // Chapter page - show stamina and farm stats
      const staminaEl = document.evaluate(
        '//*[@id="discuscontainer"]/div[1]/div[1]/div[2]/span[1]/span',
        document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
      ).singleNodeValue;
      
      const farmEl = document.evaluate(
        '//*[@id="discuscontainer"]/div[1]/div[1]/div[2]/span[2]/span',
        document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
      ).singleNodeValue;
      
      const staminaText = staminaEl ? staminaEl.innerText.trim() : '0/0';
      const farmText = farmEl ? farmEl.innerText.trim() : '0/0';
      
      hud.innerHTML = `⚡ Stamina: ${staminaText}<br/>🌾 Farm: ${farmText}<br/>🤖 Mode: ${extensionSettings.farmingMode === 'energy-cap' ? 'Energy Cap' : 'Energy Target'}<br/><button id="farming-hud-toggle">${isRunning ? 'Stop' : 'Start'} Farming</button>`;
    } else if (window.location.pathname.includes('/manga/')) {
      // Manga page
      hud.innerHTML = `📖 Manga Page<br/>🤖 Mode: ${extensionSettings.farmingMode === 'energy-cap' ? 'Energy Cap' : 'Energy Target'}<br/>Auto Farming: ${isRunning}<br/><button id="farming-hud-toggle">${isRunning ? 'Stop' : 'Start'} Farming</button>`;
    } else {
      // Homepage
      hud.innerHTML = isRunning ? 
        'Veyra Automation Script v1.2<br/>Running Auto Farming<br/><button id="farming-hud-toggle">Stop Farming</button>' :
        `Veyra Automation Script v1.2<br/><br/>🤖 Mode: ${extensionSettings.farmingMode === 'energy-cap' ? 'Energy Cap' : 'Energy Target'}<br/>Configure in Settings<br/><button id="farming-hud-toggle">Start Farming</button>`;
    }
    
    // Setup farming HUD toggle button
    setTimeout(() => {
      const toggleBtn = document.getElementById('farming-hud-toggle');
      if (toggleBtn && !toggleBtn.hasAttribute('data-listener-added')) {
        toggleBtn.addEventListener('click', toggleFarmingAutomationHUD);
        toggleBtn.setAttribute('data-listener-added', 'true');
      }
    }, 100);
  }

  function getStamina() {
    const staminaEl = document.evaluate(
      '//*[@id="discuscontainer"]/div[1]/div[1]/div[2]/span[1]/span',
      document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
    ).singleNodeValue;
    if (!staminaEl) return null;
    const [current, max] = staminaEl.innerText.split('/').map(s => parseInt(s.trim()));
    return { current, max };
  }

  function getFarm() {
    const farmEl = document.evaluate(
      '//*[@id="discuscontainer"]/div[1]/div[1]/div[2]/span[2]/span',
      document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
    ).singleNodeValue;
    if (!farmEl) return null;
    const [current, max] = farmEl.innerText.split('/').map(s => parseInt(s.replace(/,/g, '').trim(), 10));
    return { current, max };
  }

  function checkUserLogin() {
    const userInfo = document.querySelector('.comments-section .user-info');
    if (!userInfo) {
      console.log('User not logged in, clearing cookies and redirecting to login');
      // Clear all cookies for this domain
      document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
      });
      // Save current page for resume
      sessionStorage.setItem("veyra_resume_page", window.location.href);
      window.location.href = "https://demonicscans.org/signin.php";
      return false;
    }
    return true;
  }

  function checkFarmingLimits() {
    const stamina = getStamina();
    const farm = getFarm();
    if (!stamina || !farm) return false;
    
    if (!getFarmingAutomation()) return false;
    
    // Check if user is still logged in
    if (!checkUserLogin()) return false;
    
    const farmingMode = extensionSettings.farmingMode;
    
    if (farmingMode === 'energy-cap') {
      const minusEnergyCap = extensionSettings.energyCap;
      if (stamina.max - stamina.current <= minusEnergyCap) {
        setFarmingAutomation(false);
        updateFarmingHUD();
        return false;
      }
    } else {
      const targetEnergy = extensionSettings.energyTarget;
      if (stamina.current >= targetEnergy) {
        setFarmingAutomation(false);
        updateFarmingHUD();
        return false;
      }
    }
    
    if (farm.current >= farm.max) {
      setFarmingAutomation(false);
      startFarming();
      return false;
    }
    
    return true;
  }

  function clickReaction() {
    const reaction = document.evaluate(
      '/html/body/div[5]/center/div/div[1]/div[3]/div[1]',
      document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
    ).singleNodeValue;
    
    if (reaction) {
      reaction.scrollIntoView();
      reaction.click();
      console.log('✅ Clicked reaction on', window.location.href);
      return true;
    } else {
      console.log('⚠️ Reaction not found on', window.location.href);
      console.log('User not logged in, clearing cookies and redirecting to login');
      // Clear all cookies for this domain
      document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
      });
      // Save current page for resume
      sessionStorage.setItem("veyra_resume_page", window.location.href);
      window.location.href = "https://demonicscans.org/signin.php";
      return false;
    }
  }

  function goNextPage() {
    const nextBtn = document.querySelector('body > div.chapter-info > div > a.nextchap');
    
    if (nextBtn) {
      console.log('➡️ Navigating to next chapter:', nextBtn.href);
      window.location.href = nextBtn.href;
    } else {
      console.log('❌ Next button not found, picking new manga');
      startFarming();
    }
  }

  function startFarming() {
    if (!getFarmingAutomation()) return;
    window.location.href = 'https://demonicscans.org';
  }

  function pickRandomManga() {
    const owlItems = document.querySelectorAll('.owl-item .owl-element a');
    if (owlItems.length === 0) {
      setTimeout(pickRandomManga, 1000);
      return;
    }
    
    const randomIndex = Math.floor(Math.random() * owlItems.length);
    const randomManga = owlItems[randomIndex];
    console.log('Picked random manga:', randomManga.href);
    window.location.href = randomManga.href;
  }

  function startFromLastChapter() {
    const chapters = document.querySelectorAll('#chapters-list > li > a');
    if (chapters.length === 0) {
      setTimeout(startFromLastChapter, 1000);
      return;
    }
    
    const lastChapter = chapters[chapters.length - 1];
    console.log('Starting from last chapter:', lastChapter.href);
    window.location.href = lastChapter.href;
  }

  function runFarming() {
    updateFarmingHUD();
    
    // Handle login detection on chapter pages
    if (checkLoginOnChapterPage()) return;
    
    // Handle auto-login
    if (window.location.href.includes("signin.php")) {
      if (autoLogin()) return;
      return; // wait for manual login if auto-login fails
    }
    
    // Handle resume after login
    if (handleResumeAfterLogin()) return;
    
    // Handle different page types
    if (window.location.pathname === '/' && getFarmingAutomation()) {
      pickRandomManga();
      return;
    }
    
    // Check if we're on manga page and need to pick last chapter
    if (window.location.pathname.includes('/manga/') && getFarmingAutomation()) {
      startFromLastChapter();
      return;
    }
    
    // Only run farming logic if on chapter pages
    if (!window.location.pathname.includes('/title/') || !window.location.pathname.includes('/chapter/')) return;
    
    if (!checkFarmingLimits()) {
      if (!getFarmingAutomation()) return;
      setTimeout(runFarming, 5000);
      return;
    }
    
    const reactSuccess = clickReaction();
    if (reactSuccess) {
      setTimeout(() => {
        goNextPage();
      }, 1500);
    }
  }

  function initFarmingAutomation() {
    // Only run on main site pages
    if (window.location.hostname !== 'demonicscans.org' || 
        window.location.pathname.includes('.php')) return;
    
    createFarmingHUD();
    
    if (getFarmingAutomation()) {
      setTimeout(runFarming, 1000);
    }
  }

  function initRankingSideBySide(){
    // Remove the Orc King image if it exists
    const orcKingImg = document.querySelector('img[alt="Orc King of Grakthar"]');
    if (orcKingImg) {
      console.log('Removing Orc King of Grakthar image');
      orcKingImg.remove();
    }

    // Only proceed with side-by-side layout if we have enough panels
    var panels = document.querySelectorAll('div.panel');
    if (panels.length >= 2) {
      var container = document.createElement('div');
      container.classList.add('ranking-wrapper');
      container.style.cssText = 'display:flex';
      
      var topDmg = panels[panels.length-2];
      var topKills = panels[panels.length-1];
      
      // Add event-table class to tables if they exist
      const topDmgTable = topDmg.querySelector('table');
      const topKillsTable = topKills.querySelector('table');
      
      if (topDmgTable) topDmgTable.classList.add('event-table');
      if (topKillsTable) topKillsTable.classList.add('event-table');
      
      if (!isMobileView) topKills.style.marginLeft = "20px";
      container.appendChild(topDmg);
      container.appendChild(topKills);
      
      const wrap = document.querySelector('.wrap');
      if (wrap) {
        wrap.appendChild(container);
        console.log('Applied side-by-side ranking layout');
      }
    } else {
      console.log('Not enough panels found for side-by-side layout');
    }
  }

  // AUTO-UPDATE INVENTORY QUANTITIES
  // Periodically refresh inventory item quantities for pinned consumables
  function startInventoryQuantityUpdater() {
      // Only update if we have pinned consumables and we're not on inventory page
      if (!extensionSettings.pinnedInventoryItems.some(item => item.type === 'consumable')) return;
      if (window.location.pathname.includes('inventory.php')) return;
      
      setInterval(async () => {
          try {
              const response = await fetch('inventory.php');
              const html = await response.text();
              
              const sections = html.split('🧪 Consumables');
              if (sections.length < 2) return;
              
              const consumablesSection = sections[1].split('⚒️ Materials')[0];
              const parser = new DOMParser();
              const doc = parser.parseFromString(consumablesSection, 'text/html');
              const slots = doc.querySelectorAll('.slot-box');
              
              let updated = false;
              
              for (const pinnedItem of extensionSettings.pinnedInventoryItems) {
                  if (pinnedItem.type !== 'consumable') continue;
                  
                  let found = false;
                  for (const slot of slots) {
                      const img = slot.querySelector('img');
                      if (img && img.alt === pinnedItem.name) {
                          const quantityMatch = slot.textContent.match(/x(\d+)/);
                          const currentQuantity = quantityMatch ? parseInt(quantityMatch[1], 10) : 1;
                          
                          if (currentQuantity !== pinnedItem.quantity) {
                              pinnedItem.quantity = currentQuantity;
                              updated = true;
                          }
                          found = true;
                          break;
                      }
                  }
                  
                  // If item not found, set quantity to 0
                  if (!found && pinnedItem.quantity > 0) {
                      pinnedItem.quantity = 0;
                      updated = true;
                  }
              }
              
              if (updated) {
                  saveSettings();
                  updateSidebarInventorySection();
              }
              
          } catch (error) {
              console.log('Inventory quantity update failed:', error);
          }
      }, 30000); // Update every 30 seconds
  }

  // Initialize quantity updater when extension loads
  document.addEventListener('DOMContentLoaded', () => {
      setTimeout(startInventoryQuantityUpdater, 5000); // Start after 5 seconds
      // Also fetch stats on page load
      setTimeout(fetchAndUpdateSidebarStats, 1000);
  });

  // Fetch and update sidebar stats
  function fetchAndUpdateSidebarStats() {
      // Try to get stats from the current page first (if on stats page)
      if (window.location.pathname.includes('stats.php')) {
          const points = document.getElementById('v-points')?.textContent || '0';
          const attack = document.getElementById('v-attack')?.textContent || '0';
          const defense = document.getElementById('v-defense')?.textContent || '0';
          const stamina = document.getElementById('v-stamina')?.textContent || '0';
          
          if (points !== '0' || attack !== '0' || defense !== '0' || stamina !== '0') {
              updateSidebarStats({
                  STAT_POINTS: points,
                  ATTACK: attack,
                  DEFENSE: defense,
                  STAMINA: stamina
              });
              return;
          }
      }
      
      // If not on stats page or no data found, try to fetch from stats page
      fetch('stats.php')
      .then(response => response.text())
      .then(html => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          
          const points = doc.getElementById('v-points')?.textContent || '0';
          const attack = doc.getElementById('v-attack')?.textContent || '0';
          const defense = doc.getElementById('v-defense')?.textContent || '0';
          const stamina = doc.getElementById('v-stamina')?.textContent || '0';
          
          updateSidebarStats({
              STAT_POINTS: points,
              ATTACK: attack,
              DEFENSE: defense,
              STAMINA: stamina
          });
      })
      .catch(err => {
          console.error('Stats fetch error:', err);
          // Fallback: try to get from any existing elements on current page
          const points = document.getElementById('v-points')?.textContent || '0';
          const attack = document.getElementById('v-attack')?.textContent || '0';
          const defense = document.getElementById('v-defense')?.textContent || '0';
          const stamina = document.getElementById('v-stamina')?.textContent || '0';
          
          if (points !== '0' || attack !== '0' || defense !== '0' || stamina !== '0') {
              updateSidebarStats({
                  STAT_POINTS: points,
                  ATTACK: attack,
                  DEFENSE: defense,
                  STAMINA: stamina
              });
          }
      });
  }

  // Update sidebar stats display
  function updateSidebarStats(userData) {
      const sidebarPoints = document.getElementById('sidebar-points');
      const sidebarAttack = document.getElementById('sidebar-attack');
      const sidebarDefense = document.getElementById('sidebar-defense');
      const sidebarStamina = document.getElementById('sidebar-stamina');
      
      // Update allocation section too
      const sidebarPointsAlloc = document.getElementById('sidebar-points-alloc');
      const sidebarAttackAlloc = document.getElementById('sidebar-attack-alloc');
      const sidebarDefenseAlloc = document.getElementById('sidebar-defense-alloc');
      const sidebarStaminaAlloc = document.getElementById('sidebar-stamina-alloc');

      if (sidebarPoints) sidebarPoints.textContent = userData.STAT_POINTS || userData.stat_points || 0;
      if (sidebarAttack) sidebarAttack.textContent = userData.ATTACK || userData.attack || 0;
      if (sidebarDefense) sidebarDefense.textContent = userData.DEFENSE || userData.defense || 0;
      if (sidebarStamina) sidebarStamina.textContent = userData.STAMINA || userData.MAX_STAMINA || userData.stamina || 0;

      if (sidebarPointsAlloc) sidebarPointsAlloc.textContent = userData.STAT_POINTS || userData.stat_points || 0;
      if (sidebarAttackAlloc) sidebarAttackAlloc.textContent = userData.ATTACK || userData.attack || 0;
      if (sidebarDefenseAlloc) sidebarDefenseAlloc.textContent = userData.DEFENSE || userData.defense || 0;
      if (sidebarStaminaAlloc) sidebarStaminaAlloc.textContent = userData.STAMINA || userData.MAX_STAMINA || userData.stamina || 0;
  }

  // SIDEBAR SECTION UPDATES
  function updateSidebarInventorySection() {
      const inventoryContent = document.getElementById('inventory-expanded');
      if (!inventoryContent) return;

    // Updating sidebar inventory section

    let content = '<div class="sidebar-quick-access">';
    
      if (extensionSettings.pinnedInventoryItems.length === 0) {
          content += '<div class="quick-access-empty">No pinned items. Visit inventory to pin items.</div>';
    } else {
          extensionSettings.pinnedInventoryItems.forEach(item => {
              // Always show quantity for consumables, even if it's 1
              const displayQuantity = item.type === 'consumable' ? ` (x${item.quantity || 1})` : '';
              const itemKey = item.type === 'consumable' ? item.name : item.id;
        
        content += `
                  <div class="quick-access-item" data-item-id="${item.id}" data-item-name="${item.name}" data-item-type="${item.type}">
            <div class="qa-item-header">
                          <img src="${item.image}" alt="${item.name}" style="width: 24px; height: 24px; border-radius: 4px;" onerror="this.style.display='none'">
              <div class="qa-item-info">
                              <div class="qa-item-name">${item.name}</div>
                              <div class="qa-item-stats">Available: ${item.quantity}</div>
              </div>
                          <button class="qa-remove-btn" data-action="remove">×</button>
            </div>
            <div class="qa-item-actions">
                          ${item.type === 'consumable' && item.quantity > 0 ? 
                            `<div class="qa-use-controls" style="display: flex; align-items: center; gap: 5px;">
                              <div class="qty-wrap" style="display: flex; align-items: center; border: 1px solid #45475a; border-radius: 4px; background: #1e1e2e;">
                                <button type="button" class="qty-btn minus" style="background: #f38ba8; color: white; border: none; padding: 2px 6px; cursor: pointer; border-radius: 3px 0 0 3px;">−</button>
                                <input type="number" class="qty-input" min="1" max="${item.quantity}" step="1" value="1" style="width: 30px; padding: 2px; background: #1e1e2e; color: #cdd6f4; border: none; text-align: center; font-size: 10px;">
                                <button type="button" class="qty-btn plus" style="background: #a6e3a1; color: #1e1e2e; border: none; padding: 2px 6px; cursor: pointer; border-radius: 0 3px 3px 0;">+</button>
                              </div>
                              <button class="qa-use-btn" data-action="use" style="background: #74c0fc; color: #1e1e2e; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: bold;">Use</button>
                            </div>` :
                            item.type === 'equipment' ?
                            `<button class="qa-equip-btn" data-action="equip">View</button>` :
                            `<span style="font-size: 11px; color: #888;">Material</span>`
                          }
                          ${item.type === 'consumable' && item.quantity === 0 ? 
                            `<span style="font-size: 11px; color: #f38ba8;">Out of stock</span>` : ''
                          }
            </div>
          </div>
        `;
      });
    }
    
    content += '</div>';
    inventoryContent.innerHTML = content;
    
    // Add event listeners for inventory quick access buttons
    setupInventoryQuickAccessListeners();
    
    // Note: refreshPinnedItemQuantities() is called separately to avoid infinite loops
  }

  function updateSidebarMerchantSection() {
    const merchantContent = document.getElementById('merchant-expanded');
    if (!merchantContent) return;

    let content = '<div class="sidebar-quick-access">';
    
    if (extensionSettings.pinnedMerchantItems.length === 0) {
      content += '<div class="quick-access-empty">No pinned items. Visit merchant to pin items.</div>';
    } else {
      extensionSettings.pinnedMerchantItems.forEach(item => {
              const remaining = item.maxQ > 0 ? Math.max(0, item.maxQ - item.bought) : 999;
              const canBuy = item.maxQ === 0 || remaining > 0;
        
        content += `
                  <div class="quick-access-item" data-item-id="${item.id}" data-item-name="${item.name}" data-item-currency="${item.currency}" data-item-price="${item.price}">
            <div class="qa-item-header">
                          <img src="${item.image}" alt="${item.name}" style="width: 24px; height: 24px; border-radius: 4px;" onerror="this.style.display='none'">
              <div class="qa-item-info">
                <div class="qa-item-name">${item.name}</div>
                              <div class="qa-item-price">${item.priceDisplay}</div>
                              ${item.maxQ > 0 ? `<div class="qa-item-limit">Remaining: ${remaining}/${item.maxQ}</div>` : ''}
              </div>
                          <button class="qa-remove-btn" data-action="remove">×</button>
            </div>
            <div class="qa-item-actions">
                          <button class="qa-buy-btn" ${!canBuy ? 'disabled' : ''} data-action="buy">
                              ${canBuy ? 'Buy' : 'Sold Out'}
              </button>
            </div>
          </div>
        `;
      });
    }
    
    content += '</div>';
    merchantContent.innerHTML = content;
    
    // Add event listeners for merchant quick access buttons
    setupMerchantQuickAccessListeners();
  }

  // Setup event listeners for quick access buttons
  function setupInventoryQuickAccessListeners() {
    const inventoryContent = document.getElementById('inventory-expanded');
    if (!inventoryContent) return;

    // Remove button listeners
    inventoryContent.querySelectorAll('.qa-remove-btn[data-action="remove"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const item = btn.closest('.quick-access-item');
        const itemId = item?.dataset.itemId;
        const itemName = item?.dataset.itemName;
        if (itemId && itemName) {
          removeFromInventoryQuickAccess(itemId, itemName);
        }
      });
    });
    
    // Quantity selector listeners
    const minusButtons = inventoryContent.querySelectorAll('.qty-btn.minus');
    const plusButtons = inventoryContent.querySelectorAll('.qty-btn.plus');
    
    // Found quantity control buttons
    
    minusButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const input = btn.parentElement.querySelector('.qty-input');
        if (input) {
          const currentValue = parseInt(input.value) || 1;
          const newValue = Math.max(1, currentValue - 1);
          input.value = newValue;
        } else {
          console.error('Could not find qty-input element');
        }
      });
    });

    plusButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const input = btn.parentElement.querySelector('.qty-input');
        if (input) {
          const currentValue = parseInt(input.value) || 1;
          const maxValue = parseInt(input.max) || 1;
          const newValue = Math.min(maxValue, currentValue + 1);
          input.value = newValue;
        } else {
          console.error('Could not find qty-input element');
        }
      });
    });
    
    // Use button listeners
    inventoryContent.querySelectorAll('.qa-use-btn[data-action="use"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const item = btn.closest('.quick-access-item');
        const itemId = item?.dataset.itemId;
        const itemName = item?.dataset.itemName;
        const itemType = item?.dataset.itemType;
        const qtyInput = item?.querySelector('.qty-input');
        const quantity = qtyInput ? parseInt(qtyInput.value) || 1 : 1;
        
        if (itemId && itemName && itemType) {
          // Use the website's native useItem function if available, otherwise use direct API call
          if (typeof useItem === 'function') {
            useItem(itemId, 30, itemName, quantity); // Assuming item type 30 for stamina potions
            showNotification(`✅ Used ${quantity}x ${itemName}`, 'success');
          } else {
            // Use direct API call when native function isn't available
            useItemDirectly(itemId, itemName, quantity);
          }
        }
      });
    });
    
    // Multiple use button listeners
    inventoryContent.querySelectorAll('.qa-use-multiple-btn[data-action="use-multiple"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const item = btn.closest('.quick-access-item');
        const itemId = item?.dataset.itemId;
        const itemName = item?.dataset.itemName;
        const itemType = item?.dataset.itemType;
        if (itemId && itemName && itemType) {
          // Use the website's native useItem function with default quantity
          if (typeof useItem === 'function') {
            useItem(itemId, 30, itemName, extensionSettings.multiplePotsCount || 3);
            showNotification(`✅ Used ${extensionSettings.multiplePotsCount || 3}x ${itemName}`, 'success');
          } else {
            // Use direct API call when native function isn't available
            useItemDirectly(itemId, itemName, extensionSettings.multiplePotsCount || 3);
          }
        }
      });
    });
    
    // Equip button listeners
    inventoryContent.querySelectorAll('.qa-equip-btn[data-action="equip"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const item = btn.closest('.quick-access-item');
        const itemId = item?.dataset.itemId;
        const itemName = item?.dataset.itemName;
        const itemType = item?.dataset.itemType;
        if (itemId && itemName && itemType) {
          executeInventoryAction({id: itemId, name: itemName, type: itemType}, 'equip');
        }
      });
    });
  }

  function setupMerchantQuickAccessListeners() {
    const merchantContent = document.getElementById('merchant-expanded');
    if (!merchantContent) return;
    
    // Remove button listeners
    merchantContent.querySelectorAll('.qa-remove-btn[data-action="remove"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const item = btn.closest('.quick-access-item');
        const itemId = item?.dataset.itemId;
        if (itemId) {
          removeFromMerchantQuickAccess(itemId);
        }
      });
    });
    
    // Buy button listeners
    merchantContent.querySelectorAll('.qa-buy-btn[data-action="buy"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (btn.disabled) return;
        
        const item = btn.closest('.quick-access-item');
        const itemId = item?.dataset.itemId;
        const itemName = item?.dataset.itemName;
        const itemCurrency = item?.dataset.itemCurrency;
        const itemPrice = item?.dataset.itemPrice;
        
        if (itemId && itemName && itemCurrency && itemPrice) {
          executeMerchantBuy({
            id: itemId, 
            name: itemName, 
            currency: itemCurrency, 
            price: parseInt(itemPrice, 10)
          });
        }
      });
    });
  }

  // Other utility functions
  function initPvPBannerFix(){
    var contentArea = document.querySelector('.content-area');
    var seasonCountdown = document.querySelector('.season-cta');
    var pvpHero = document.querySelector('.pvp-hero');
    if (pvpHero) {
      pvpHero.style.marginTop = "0px";
      if(seasonCountdown){
        contentArea.prepend(seasonCountdown)
      }
      contentArea.prepend(pvpHero)
      const br = document.querySelector('br');
      if (br) br.remove();
    }
  }

  function initPlayerAtkDamage(){
    const atkElement = document.getElementById('v-attack');
    if (!atkElement) return;

    var atkValue = Number.parseInt(atkElement.innerText.replaceAll(',','').replaceAll('.',''))
    const statCard = document.querySelectorAll('.grid .card')[1];
    if (!statCard) return;

    const defenseValues = [0, 25, 50];
    defenseValues.forEach((def, index) => {
      var statRow = document.createElement('div')
      statRow.title = `Damage is calculated based on ${def} DEF monster`
      statRow.classList.add('row')
      statRow.style.color = 'red'

      var statName = document.createElement('span')
      statName.innerText = `ATTACK DMG VS ${def} DEF`

      var statValue = document.createElement('span')
      var playerTotalDmg = calcDmg(atkValue, def)
      statValue.innerText = playerTotalDmg;

      statRow.append(statName)
      statRow.append(statValue)
      statCard.append(statRow)
    });
  }

  function calcDmg(atkValue,def){
    return Math.round(1000*((atkValue-def)**0.25));
  }

  function initPetTotalDmg(){
    const petSection = document.querySelector('.section');
    const sectionTitle = document.querySelector('.section-title');
    if (!petSection || !sectionTitle) return;

    var petTotalDmg = 0;
    petSection.querySelectorAll('.pet-atk').forEach(x => {
      petTotalDmg += Number.parseInt(x.innerText)
    });

    var finalAmount = petTotalDmg * 20;
    var totalDmgContainer = document.createElement('span');
    totalDmgContainer.id = 'total-pet-damage';
    totalDmgContainer.innerText = ' - Total pet damage: ' + finalAmount;
    totalDmgContainer.style.color = '#f38ba8';
    sectionTitle.appendChild(totalDmgContainer);
  }

  function initPetRequiredFood(){
    document.querySelectorAll('.exp-top').forEach(x => {
      var curExp = Number.parseInt(x.querySelector('.exp-current').innerText);
      var reqExp = Number.parseInt(x.querySelector('.exp-required').innerText);
      var needed = Math.ceil((reqExp - curExp) / 300);
      x.insertAdjacentHTML('afterEnd', `<div style='margin-top:5px;'><span style='color:green;margin-top:5px'>Requires ${needed} Arcane Treat S</span></div>`);
    });
  }

  function initItemTotalDmg(){
    const itemSection = document.querySelector('.section');
    const sectionTitle = document.querySelector('.section-title');
    if (!itemSection || !sectionTitle) return;

    var itemsTotalDmg = 0;
    itemSection.querySelectorAll('.label').forEach(x => {
      const labelText = x.innerText;
      const atkIndex = labelText.indexOf('🔪');
      if (atkIndex !== -1) {
        const atkText = labelText.substring(atkIndex + 3);
        const atkMatch = atkText.match(/(\d+)\s*ATK/);
        if (atkMatch) {
          itemsTotalDmg += parseInt(atkMatch[1]);
        }
      }
    });

    var finalAmount = itemsTotalDmg * 20;
    var totalDmgContainer = document.createElement('span');
    totalDmgContainer.id = 'total-item-damage';
    totalDmgContainer.innerText = ' - Total item damage: ' + finalAmount;
    totalDmgContainer.style.color = '#a6e3a1';
    sectionTitle.appendChild(totalDmgContainer);
  }

  // Function to extract item data from HTML structure
  function extractItemDataFromHTML(htmlContent) {
    // Extracting item data from HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const items = [];
    
    // Find all slot-box elements
    const slotBoxes = doc.querySelectorAll('.slot-box');
    
    slotBoxes.forEach((slot, index) => {
      const itemData = {};
      
      // Extract image and name
      const img = slot.querySelector('img');
      if (img) {
        itemData.name = img.alt;
        itemData.imageUrl = img.src;
        // Found item
      }
      
      // Extract item ID from use button
      const useButton = slot.querySelector('button[onclick*="useItem"]');
      if (useButton) {
        const onclickStr = useButton.getAttribute('onclick') || '';
        const match = onclickStr.match(/useItem\(([^)]+)\)/);
        if (match) {
          itemData.itemId = match[1];
        }
      }
      
      // Extract quantity
      const quantityMatch = slot.textContent.match(/x(\d+)/);
      if (quantityMatch) {
        itemData.quantity = parseInt(quantityMatch[1], 10);
        // Quantity found
      } else {
        itemData.quantity = 1;
      }
      
      // Extract description from info button
      const infoButton = slot.querySelector('.info-btn');
      if (infoButton) {
        itemData.description = infoButton.getAttribute('data-desc') || '';
      }
      
      // Only add items that have an item ID (usable items)
      if (itemData.itemId) {
        items.push(itemData);
        // Added item
      } else {
        // Skipped item (no item ID)
      }
    });
    
    // Extracted items
    return items;
  }
  // Function to automatically click "show more" buttons
  async function autoClickShowMore() {
    const showMoreButtons = document.querySelectorAll('button, a, input[type="button"]');
    let clickedAny = false;
    
    for (const button of showMoreButtons) {
      const buttonText = button.textContent || button.value || '';
      const buttonTitle = button.title || '';
      
      // Look for "show more", "load more", "more", etc.
      if (buttonText.toLowerCase().includes('more') || 
          buttonText.toLowerCase().includes('load') ||
          buttonTitle.toLowerCase().includes('more') ||
          buttonTitle.toLowerCase().includes('load')) {
        
        console.log(`Auto-clicking "show more" button: ${buttonText}`);
        button.click();
        clickedAny = true;
        
        // Wait a bit for content to load
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return clickedAny;
  }

  // Function to get all consumable items from the page
  async function getAllConsumableItems() {
    console.log('Getting all consumable items...');
    
    // First, try to get items from the current page if we're on inventory
    if (window.location.pathname.includes('inventory.php')) {
      console.log('On inventory page, extracting items from current page...');
      const currentItems = extractItemDataFromHTML(document.documentElement.outerHTML);
      
      if (currentItems.length > 0) {
        console.log(`Found ${currentItems.length} items on current page`);
        return currentItems;
      }
      
      // If no items found, try clicking "show more" buttons
      console.log('No items found, trying to click "show more" buttons...');
      let hasMoreContent = true;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (hasMoreContent && attempts < maxAttempts) {
        attempts++;
        console.log(`Show more attempt ${attempts}`);
        
        hasMoreContent = await autoClickShowMore();
        
        if (hasMoreContent) {
          // Wait for new content to load
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Extract items from updated page
          const newItems = extractItemDataFromHTML(document.documentElement.outerHTML);
          if (newItems.length > 0) {
            console.log(`Found ${newItems.length} items after show more`);
            return newItems;
          }
        }
      }
    }
    
    // If we're not on inventory page or show more didn't work, fetch inventory page
    console.log('Fetching inventory page via AJAX...');
    try {
      const response = await fetch('inventory.php');
      const html = await response.text();
      console.log('Fetched inventory HTML length:', html.length);
      
      const items = extractItemDataFromHTML(html);
      console.log(`Found ${items.length} items from fetched inventory`);
      return items;
      
    } catch (error) {
      console.error('Failed to fetch inventory page:', error);
      return [];
    }
  }

  // Function to find a specific item by name
  async function findItemByName(itemName) {
    // Looking for item
    
    // First, try to get items from the current page if we're on inventory
    if (window.location.pathname.includes('inventory.php')) {
      // On inventory page, search directly in DOM (much faster)
      const slotBoxes = document.querySelectorAll('.slot-box');
      
      for (const slot of slotBoxes) {
        const img = slot.querySelector('img');
        if (img && img.alt && img.alt.toLowerCase() === itemName.toLowerCase()) {
          // Found the item, extract its data directly
          const itemData = {};
          itemData.name = img.alt;
          itemData.imageUrl = img.src;
          
          // Extract item ID from use button
          const useButton = slot.querySelector('button[onclick*="useItem"]');
          if (useButton) {
            const onclickStr = useButton.getAttribute('onclick') || '';
            const match = onclickStr.match(/useItem\(([^)]+)\)/);
            if (match) {
              itemData.itemId = match[1];
            }
          }
          
          // Extract quantity
          const quantityMatch = slot.textContent.match(/x(\d+)/);
          if (quantityMatch) {
            itemData.quantity = parseInt(quantityMatch[1], 10);
          } else {
            itemData.quantity = 1;
          }
          
          return itemData;
        }
      }
      
      // If not found, try clicking "show more" buttons
      let hasMoreContent = true;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (hasMoreContent && attempts < maxAttempts) {
        attempts++;
        console.log(`Show more attempt ${attempts}`);
        
        hasMoreContent = await autoClickShowMore();
        
        if (hasMoreContent) {
          // Wait for new content to load
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Search directly in DOM again (much faster than parsing HTML)
          const newSlotBoxes = document.querySelectorAll('.slot-box');
          for (const slot of newSlotBoxes) {
            const img = slot.querySelector('img');
            if (img && img.alt && img.alt.toLowerCase() === itemName.toLowerCase()) {
              // Found the item, extract its data directly
              const itemData = {};
              itemData.name = img.alt;
              itemData.imageUrl = img.src;
              
              // Extract item ID from use button
              const useButton = slot.querySelector('button[onclick*="useItem"]');
              if (useButton) {
                const onclickStr = useButton.getAttribute('onclick') || '';
                const match = onclickStr.match(/useItem\(([^)]+)\)/);
                if (match) {
                  itemData.itemId = match[1];
                }
              }
              
              // Extract quantity
              const quantityMatch = slot.textContent.match(/x(\d+)/);
              if (quantityMatch) {
                itemData.quantity = parseInt(quantityMatch[1], 10);
              } else {
                itemData.quantity = 1;
              }
              
              return itemData;
            }
          }
        }
      }
    }
    
    // If we're not on inventory page or show more didn't work, fetch inventory page
    console.log('Fetching inventory page via AJAX...');
    try {
      const response = await fetch('inventory.php');
      const html = await response.text();
      console.log('Fetched inventory HTML length:', html.length);
      
      const items = extractItemDataFromHTML(html);
      const foundItem = items.find(item => 
        item.name && item.name.toLowerCase() === itemName.toLowerCase()
      );
      
      if (foundItem) {
        console.log(`Found "${foundItem.name}" from fetched inventory`);
        return foundItem;
      } else {
        console.log(`Item "${itemName}" not found in inventory`);
        return null;
      }
      
    } catch (error) {
      console.error('Failed to fetch inventory page:', error);
      return null;
    }
  }

  function initAlternativeInventoryView(){
    if (!window.location.pathname.includes('inventory.php')) return;

    const header = document.querySelector('h1');
    if (header) {
      header.style.cursor = 'pointer';
      header.title = 'Click to toggle between grid and table view';
      const viewIndicator = document.createElement('span');
      viewIndicator.id = 'view-indicator';
      viewIndicator.style.marginLeft = '10px';
      viewIndicator.style.fontSize = '14px';
      viewIndicator.style.color = '#cba6f7';
      header.appendChild(viewIndicator);

      const savedView = localStorage.getItem('inventoryView') || 'grid';
      viewIndicator.textContent = `[${savedView.toUpperCase()} VIEW]`;

      if (savedView === 'table') {
        convertToTableView();
      }

      header.addEventListener('click', toggleInventoryView);
    }

    function toggleInventoryView() {
      const viewIndicator = document.getElementById('view-indicator');
      const currentView = viewIndicator.textContent.includes('TABLE') ? 'table' : 'grid';
      const newView = currentView === 'table' ? 'grid' : 'table';

      viewIndicator.textContent = `[${newView.toUpperCase()} VIEW]`;
      localStorage.setItem('inventoryView', newView);

      if (newView === 'table') {
        convertToTableView();
      } else {
        convertToGridView();
      }
    }

    function convertToTableView() {
      document.querySelectorAll('.inventory-table').forEach(table => table.remove());

      const sections = document.querySelectorAll('.section');
      sections.forEach(section => {
        const grid = section.querySelector('.grid');

        if (grid) {
          grid.style.display = 'none';

          const table = document.createElement('table');
          table.className = 'inventory-table';
          table.style.cssText = `
            width: 100%;
            border-collapse: collapse;
            background: rgba(30, 30, 46, 0.8);
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 20px;
          `;
          table.innerHTML = `
            <thead>
              <tr style="background: rgba(203, 166, 247, 0.2);">
                <th style="padding: 12px; text-align: left; border-bottom: 1px solid #585b70;">Item</th>
                <th style="padding: 12px; text-align: left; border-bottom: 1px solid #585b70;">Details</th>
                <th style="padding: 12px; text-align: left; border-bottom: 1px solid #585b70;">Actions</th>
              </tr>
            </thead>
            <tbody></tbody>
          `;

          const tbody = table.querySelector('tbody');
          const items = grid.querySelectorAll('.slot-box');
          items.forEach(item => {
            const row = document.createElement('tr');
            row.style.cssText = 'border-bottom: 1px solid rgba(88, 91, 112, 0.3);';

            const img = item.querySelector('img');
            const imgSrc = img ? img.src : '';
            const imgAlt = img ? img.alt : '';

            const label = item.querySelector('.label');
            const labelText = label ? label.textContent : '';

            const buttons = item.querySelectorAll('button');

            row.innerHTML = `
              <td class="table-item-image" style="padding: 12px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <img src="${imgSrc}" alt="${imgAlt}" onerror="this.style.display='none'"
                       style="width: 40px; height: 40px; border-radius: 4px;">
                  <div class="table-item-name" style="color: #e0e0e0;">${imgAlt}</div>
                </div>
              </td>
              <td class="table-item-details" style="padding: 12px; color: #cdd6f4;">${labelText}</td>
              <td class="table-item-actions" style="padding: 12px;"></td>
            `;

            const actionsCell = row.querySelector('.table-item-actions');
            buttons.forEach(button => {
              if (!button.classList.contains('info-btn')) {
                const buttonClone = button.cloneNode(true);
                buttonClone.style.marginRight = '8px';
                actionsCell.appendChild(buttonClone);
              }
            });

            const infoBtn = item.querySelector('.info-btn');
            if (infoBtn) {
              const infoClone = infoBtn.cloneNode(true);
              actionsCell.appendChild(infoClone);
            }

            tbody.appendChild(row);
          });

          section.insertBefore(table, grid);
        }
      });
    }

    function convertToGridView() {
      document.querySelectorAll('.inventory-table').forEach(table => table.remove());
      document.querySelectorAll('.grid').forEach(grid => {
        grid.style.display = 'flex';
      });
    }
  }

  // Stat allocation section
  function initStatAllocation() {
    const statsContainer = document.querySelector('.grid');
    if (!statsContainer) return;

    const existingSection = document.querySelector('#stat-allocation-section');
    if (existingSection) existingSection.remove();

    const statAllocationSection = document.createElement('div');
    statAllocationSection.id = 'stat-allocation-section';
    statAllocationSection.style.cssText = `
      background: rgba(30, 30, 46, 0.8);
      border: 1px solid #585b70;
      border-radius: 10px;
      margin: 20px 0;
      overflow: hidden;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      padding: 15px 20px;
      background: rgba(203, 166, 247, 0.1);
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: bold;
      color: #cba6f7;
    `;

    const currentPoints = document.getElementById('v-points')?.textContent || '0';
    const availablePoints = parseInt(currentPoints);

    header.innerHTML = `
      <span>📊 Stat Allocation</span>
      <span id="stat-toggle-icon">${extensionSettings.statAllocationCollapsed ? '[+]' : '[–]'}</span>
    `;

    const content = document.createElement('div');
    content.id = 'stat-allocation-content';
    content.style.cssText = `
      padding: 20px;
      display: ${extensionSettings.statAllocationCollapsed ? 'none' : 'block'};
    `;

    content.innerHTML = `
      <div style="margin-bottom: 15px; color: #f9e2af; font-weight: bold;">
        Available Points: ${availablePoints}
      </div>
      <div class="stat-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 10px; background: rgba(69, 71, 90, 0.3); border-radius: 8px;">
        <span style="color: #e0e0e0; min-width: 80px;">Strength:</span>
        <div style="display: flex; gap: 10px; align-items: center;">
          <button class="stat-btn" onclick="allocateStatPoints('attack', 1)" ${availablePoints < 1 ? 'disabled' : ''}
                  style="background:rgb(6, 6, 6); color: #1e1e2e; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">+1</button>
          <button class="stat-btn" onclick="allocateStatPoints('attack', 5)" ${availablePoints < 5 ? 'disabled' : ''}
                  style="background: #a6e3a1; color: #1e1e2e; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">+5</button>
        </div>
      </div>
      <div class="stat-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 10px; background: rgba(69, 71, 90, 0.3); border-radius: 8px;">
        <span style="color: #e0e0e0; min-width: 80px;">Agility:</span>
        <div style="display: flex; gap: 10px; align-items: center;">
          <button class="stat-btn" onclick="allocateStatPoints('defense', 1)" ${availablePoints < 1 ? 'disabled' : ''}
                  style="background: #74c0fc; color: #1e1e2e; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">+1</button>
          <button class="stat-btn" onclick="allocateStatPoints('defense', 5)" ${availablePoints < 5 ? 'disabled' : ''}
                  style="background: #74c0fc; color: #1e1e2e; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">+5</button>
        </div>
      </div>
      <div class="stat-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 10px; background: rgba(69, 71, 90, 0.3); border-radius: 8px;">
        <span style="color: #e0e0e0; min-width: 80px;">Dexterity:</span>
        <div style="display: flex; gap: 10px; align-items: center;">
          <button class="stat-btn" onclick="allocateStatPoints('stamina', 1)" ${availablePoints < 1 ? 'disabled' : ''}
                  style="background: #f9e2af; color: #1e1e2e; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">+1</button>
          <button class="stat-btn" onclick="allocateStatPoints('stamina', 5)" ${availablePoints < 5 ? 'disabled' : ''}
                  style="background: #f9e2af; color: #1e1e2e; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">+5</button>
        </div>
      </div>
    `;

    statAllocationSection.appendChild(header);
    statAllocationSection.appendChild(content);

    header.addEventListener('click', function() {
      const isCollapsed = content.style.display === 'none';
      content.style.display = isCollapsed ? 'block' : 'none';
      const toggleIcon = document.getElementById('stat-toggle-icon');
      if (toggleIcon) {
        toggleIcon.textContent = isCollapsed ? '[–]' : '[+]';
      }
      extensionSettings.statAllocationCollapsed = !isCollapsed;
      saveSettings();
    });

    statsContainer.appendChild(statAllocationSection);
  }

  // Make debug function globally available for troubleshooting
  window.debugExtension = debugExtension;
  
  // Make new functions globally available for testing
  window.extractItemDataFromHTML = extractItemDataFromHTML;
  window.autoClickShowMore = autoClickShowMore;
  window.getAllConsumableItems = getAllConsumableItems;
  window.findItemByName = findItemByName;
  
  // Test function to extract items from current page
  window.testItemExtraction = async function() {
    console.log('Testing item extraction from current page...');
    const items = await getAllConsumableItems();
    console.log('Extracted items:', items);
    return items;
  };
  
  // Simple function that just fetches inventory without clicking show more
  window.getInventoryItemsSimple = async function() {
    console.log('Fetching inventory items (simple method)...');
    try {
      const response = await fetch('inventory.php');
      const html = await response.text();
      console.log('Fetched inventory HTML length:', html.length);
      
      const items = extractItemDataFromHTML(html);
      console.log(`Found ${items.length} items from fetched inventory`);
      return items;
      
    } catch (error) {
      console.error('Failed to fetch inventory page:', error);
      return [];
    }
  };


})();