// --- CONSTANTS ---
const SPRITE_BASE_URL = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/";
const GAMES = [
    { value: "gold", text: "Pokémon Gold", generation: 2 },
    { value: "silver", text: "Pokémon Silver", generation: 2 },
    { value: "crystal", text: "Pokémon Crystal (Data Pending)", generation: 2, disabled: true },
    { value: "red", text: "Pokémon Red", generation: 1 },
    { value: "blue", text: "Pokémon Blue", generation: 1 },
    { value: "yellow", text: "Pokémon Yellow", generation: 1 },
    { value: "ruby", text: "Pokémon Ruby", generation: 3, regionalDex: "hoenn" },
    { value: "sapphire", text: "Pokémon Sapphire", generation: 3, regionalDex: "hoenn" },
    { value: "emerald", text: "Pokémon Emerald", generation: 3, regionalDex: "hoenn" },
    { value: "firered", text: "Pokémon FireRed", generation: 3, regionalDex: "kanto" },
    { value: "leafgreen", text: "Pokémon LeafGreen", generation: 3, regionalDex: "kanto" }
];
const REGIONAL_DEX_LABELS = { hoenn: "Hoenn (202)", kanto: "Kanto (151)" };
const DATA_FILES = [
    { generation: 1, file: 'pokemon-data-gen1.json' },
    { generation: 2, file: 'pokemon-data-gen2.json' },
    { generation: 3, file: 'pokemon-data-gen3.json' }
];

// --- GLOBAL STATE ---
let currentGame = 'gold'; // Default game
let dexMode = 'regional'; // 'regional' or 'national', only used for Gen III games
let pokemonData = []; // Combined list of all Pokémon
let caughtDataForCurrentGame = {}; // { pokemonId: true/false } for the selected game
let allLoadedCaughtData = {}; // Cache for all games' caught data: { gameName: { pokemonId: true/false } }
let allGameLocations = {}; // Cache for game locations: { gameName: ["Area1", "Area2"] }
let glitchMethods = { methods: {}, games: {} }; // From glitch-methods.json

// --- DOM Elements (initialized in initializeApp) ---
let gameSelector, pokedexGrid, searchInput, showUncaughtOnlyCheckbox, dexModeContainer, dexModeSelector;
let modal, modalPokemonName, modalPokemonSprite, modalCatchInfo, modalAvailabilityNote, modalCloseButton;
let areaGameSelector, areaSelector, areaPokemonGrid;
let tradeMyGameSelector, tradePartnerGameSelector, findTradesButton, canReceiveTradesList, canSendTradesList, tradeResultsPlaceholder;
let tabButtons, tabContents;
let loginButton, logoutButton, userInfo;

// --- UTILITY FUNCTIONS for Pokemon Data Processing ---
function processPokemonData(rawData) {
    return rawData.map(p => {
        const processed = { ...p }; // Shallow copy, includes 'generation' if added before calling this
        processed.sprite = `${SPRITE_BASE_URL}${p.id}.png`;

        // Ensure all game versions have a basic availability structure
        GAMES.map(g => g.value).forEach(game => {
            if (!processed.availability[game]) {
                processed.availability[game] = { catchable: false, locations: [], note: "Data pending." };
            }
            if (!processed.availability[game].locations) processed.availability[game].locations = [];
            if (typeof processed.availability[game].catchable === 'undefined') {
                processed.availability[game].catchable = processed.availability[game].locations.length > 0;
            }
        });

        processed.getCatchInfoForGame = function(gameKey) {
            const avail = this.availability[gameKey];
            if (avail) {
                let info = "";
                if (avail.locations && avail.locations.length > 0) {
                    info += "Locations: " + avail.locations.join(', ') + ". ";
                }
                if (avail.note) {
                    info += avail.note;
                }
                return info.trim() || "No specific catch info for this game in current data.";
            }
            return "Catch info not available for this game.";
        };
        return processed;
    });
}

function gameGeneration(gameKey) {
    return GAMES.find(g => g.value === gameKey?.toLowerCase())?.generation || 1;
}

// Pokémon from a later generation than the game don't exist in it.
function existsInGame(pokemon, gameKey) {
    return pokemon.generation <= gameGeneration(gameKey);
}

function regionalDexOf(gameKey) {
    return GAMES.find(g => g.value === gameKey)?.regionalDex;
}

function usesRegionalDex(gameKey) {
    return !!regionalDexOf(gameKey) && dexMode === 'regional';
}

// Number in the game's regional dex, or undefined if it isn't in it.
// The Kanto dex in FireRed/LeafGreen uses the national numbers 1–151.
function regionalNumber(pokemon, gameKey) {
    const dex = regionalDexOf(gameKey);
    if (dex === 'hoenn') return pokemon.hoennDex;
    if (dex === 'kanto') return pokemon.id <= 151 ? pokemon.id : undefined;
    return undefined;
}

// The number shown in the game's own Pokédex (regional number in regional mode).
function dexNumber(pokemon, gameKey) {
    return usesRegionalDex(gameKey) ? regionalNumber(pokemon, gameKey) ?? pokemon.id : pokemon.id;
}

function formatDexNumber(pokemon, gameKey) {
    const number = `#${dexNumber(pokemon, gameKey).toString().padStart(3, '0')}`;
    // Area Dex can show Pokémon outside the regional dex (e.g. post-game Safari Zone).
    return usesRegionalDex(gameKey) && !regionalNumber(pokemon, gameKey) ? `Nat. ${number}` : number;
}

// Pokémon visible in a game's dex, in that dex's order.
function pokemonForGame(gameKey) {
    const list = pokemonData.filter(p => existsInGame(p, gameKey) && (!usesRegionalDex(gameKey) || regionalNumber(p, gameKey)));
    if (usesRegionalDex(gameKey)) list.sort((a, b) => regionalNumber(a, gameKey) - regionalNumber(b, gameKey));
    return list;
}

async function fetchAndCombinePokemonData() {
    const loaded = [];

    for (const { generation, file } of DATA_FILES) {
        try {
            const response = await fetch(file);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} while fetching ${file}`);
            }
            const raw = await response.json();
            raw.forEach(p => p.generation = generation); // Add generation marker
            loaded.push(...processPokemonData(raw));
            console.log(`Successfully loaded Pokémon Gen${generation} data (${raw.length}).`);
        } catch (error) {
            console.error(`Failed to load Pokémon Gen${generation} data:`, error);
        }
    }

    if (loaded.length === 0) {
        console.error("Failed to load any Pokémon data.");
        if (pokedexGrid) { // Ensure pokedexGrid is available
             pokedexGrid.innerHTML = `<p class="col-span-full text-center text-red-500">Error: Could not load any Pokémon data. Please ensure the pokemon-data-gen*.json files are present and correct.</p>`;
        }
        pokemonData = []; // Initialize as empty if all loads fail
        return;
    }

    pokemonData = loaded;
    console.log("Successfully loaded and combined Pokémon data. Total count:", pokemonData.length);
    if (pokemonData.length === 0 && pokedexGrid) {
         pokedexGrid.innerHTML = `<p class="col-span-full text-center text-red-500">Error: No Pokémon data was processed. Files might be empty or corrupt.</p>`;
    }
}

async function fetchGlitchMethods() {
    try {
        const response = await fetch('glitch-methods.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} while fetching glitch-methods.json`);
        glitchMethods = await response.json();
    } catch (error) {
        console.error("Failed to load glitch methods:", error);
    }
}

// Self-hosted event and glitch routes for a Pokémon that can't be obtained normally in this game, best first.
function specialRoutesFor(pokemon, gameKey) {
    if (pokemon.availability[gameKey]?.catchable) return [];
    const entries = glitchMethods.games[gameKey]?.[pokemon.id.toString()] || [];
    return entries.map(entry => {
        const method = glitchMethods.methods[entry.method] || {};
        return { ...method, extra: entry.extra, sources: [...(entry.sources || []), ...(method.sources || [])] };
    });
}

// --- INITIALIZATION ---
async function initializeApp() {
    // Assign DOM Elements
    gameSelector = document.getElementById('gameSelector');
    pokedexGrid = document.getElementById('pokedexGrid');
    searchInput = document.getElementById('searchInput');
    showUncaughtOnlyCheckbox = document.getElementById('showUncaughtOnly');
    dexModeContainer = document.getElementById('dexModeContainer');
    dexModeSelector = document.getElementById('dexModeSelector');

    modal =document.getElementById('infoModal');
    modalPokemonName = document.getElementById('modalPokemonName');
    modalPokemonSprite = document.getElementById('modalPokemonSprite');
    modalCatchInfo = document.getElementById('modalCatchInfo');
    modalAvailabilityNote = document.getElementById('modalAvailabilityNote');
    modalCloseButton = modal.querySelector('.close-button');

    areaGameSelector = document.getElementById('areaGameSelector');
    areaSelector = document.getElementById('areaSelector');
    areaPokemonGrid = document.getElementById('areaPokemonGrid');

    tradeMyGameSelector = document.getElementById('tradeMyGameSelector');
    tradePartnerGameSelector = document.getElementById('tradePartnerGameSelector');
    findTradesButton = document.getElementById('findTradesButton');
    canReceiveTradesList = document.getElementById('canReceiveTradesList');
    canSendTradesList = document.getElementById('canSendTradesList');
    tradeResultsPlaceholder = document.getElementById('tradeResultsPlaceholder');

    loginButton = document.getElementById('loginButton');
    logoutButton = document.getElementById('logoutButton');
    userInfo = document.getElementById('userInfo');

    tabButtons = document.querySelectorAll('.tab-button');
    tabContents = document.querySelectorAll('.tab-content');

    // Set initial game from the last one used, falling back to the selector's default
    const savedGame = localStorage.getItem('currentGame');
    if (savedGame && GAMES.some(g => g.value === savedGame && !g.disabled)) gameSelector.value = savedGame;
    currentGame = gameSelector.value;
    const savedDexMode = localStorage.getItem('dexMode');
    if (['regional', 'national'].includes(savedDexMode)) dexMode = savedDexMode;
    if (dexModeSelector) dexModeSelector.value = dexMode;

    populateGameSelectors();
    await fetchAndCombinePokemonData();
    await fetchGlitchMethods();
    await switchGame(currentGame, true); // Initial load for the default game

    // Add Event Listeners
    gameSelector.addEventListener('change', (e) => switchGame(e.target.value));
    if (dexModeSelector) dexModeSelector.addEventListener('change', (e) => {
        dexMode = e.target.value;
        localStorage.setItem('dexMode', dexMode);
        renderPokedexView();
        if (document.getElementById('areaDexView')?.classList.contains('active')) renderAreaPokemon();
    });
    searchInput.addEventListener('input', renderPokedexView);
    showUncaughtOnlyCheckbox.addEventListener('change', renderPokedexView);
    if (modalCloseButton) modalCloseButton.onclick = closeModal;


    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            tabContents.forEach(content => {
                content.classList.toggle('active', content.id === tabId);
            });
            if (tabId === 'areaDexView') initializeAreaDex();
            if (tabId === 'tradeHelperView') initializeTradeHelper();
        });
    });

    if(areaGameSelector) areaGameSelector.addEventListener('change', handleAreaGameChange);
    if(areaSelector) areaSelector.addEventListener('change', renderAreaPokemon);
    if(findTradesButton) findTradesButton.addEventListener('click', executeTradeSearch);

    if (document.querySelector('.tab-button.active').dataset.tab === 'pokedexView') {
        // Default tab, rendering handled by switchGame
    }
}

function populateGameSelectors() {
    const games = GAMES;

    if (gameSelector) gameSelector.value = currentGame;

    [areaGameSelector, tradeMyGameSelector, tradePartnerGameSelector].forEach(selector => {
        if (!selector) return;
        selector.innerHTML = '';
        games.forEach(game => {
            const option = document.createElement('option');
            option.value = game.value;
            option.textContent = game.text;
            option.disabled = !!game.disabled;
            selector.appendChild(option);
        });
    });

    if (tradeMyGameSelector && tradePartnerGameSelector && games.length > 1) {
        tradeMyGameSelector.value = games[0].value;
        tradePartnerGameSelector.value = (games[0].value === "gold" && games.length > 1 && !games[1].disabled) ? games[1].value : games[0].value;
        if (tradeMyGameSelector.value === tradePartnerGameSelector.value) {
            for (const game of games) {
                if (game.value !== tradeMyGameSelector.value && !game.disabled) {
                    tradePartnerGameSelector.value = game.value;
                    break;
                }
            }
        }
    }
    if (areaGameSelector) areaGameSelector.value = currentGame;
}


// --- GAME SWITCHING & DATA HANDLING ---
async function switchGame(newGameKey, isInitialLoad = false) {
    currentGame = newGameKey;
    if (!isInitialLoad) {
        if (areaGameSelector && Array.from(areaGameSelector.options).find(opt => opt.value === currentGame && !opt.disabled)) {
            areaGameSelector.value = currentGame;
        }
        if (tradeMyGameSelector && Array.from(tradeMyGameSelector.options).find(opt => opt.value === currentGame && !opt.disabled)) {
            tradeMyGameSelector.value = currentGame;
            if (tradeMyGameSelector.value === tradePartnerGameSelector.value) {
                const games = Array.from(tradePartnerGameSelector.options).map(opt => ({value: opt.value, disabled: opt.disabled}));
                for (const game of games) {
                    if (game.value !== tradeMyGameSelector.value && !game.disabled) {
                        tradePartnerGameSelector.value = game.value;
                        break;
                    }
                }
            }
        }
    }
    console.log(`Switched to game: ${currentGame}`);
    localStorage.setItem('currentGame', currentGame);
    const regionalDex = regionalDexOf(currentGame);
    if (dexModeContainer) dexModeContainer.classList.toggle('hidden', !regionalDex);
    if (regionalDex && dexModeSelector) dexModeSelector.querySelector('option[value="regional"]').textContent = REGIONAL_DEX_LABELS[regionalDex];
    await loadCaughtDataForGame(currentGame);
    renderPokedexView();

    if (document.getElementById('areaDexView')?.classList.contains('active')) initializeAreaDex();
    if (document.getElementById('tradeHelperView')?.classList.contains('active')) initializeTradeHelper();
}

async function loadCaughtDataForGame(gameKey, forceReload = false) {
    if (!forceReload && allLoadedCaughtData[gameKey]) {
        caughtDataForCurrentGame = allLoadedCaughtData[gameKey];
        console.log(`Using cached caught data for ${gameKey}`);
        return;
    }
    try {
        const response = await fetch(`/caught/${gameKey}`);
        if (!response.ok) {
            if (response.status === 404) {
                console.log(`No save file found for ${gameKey} on server, starting fresh.`);
                allLoadedCaughtData[gameKey] = {};
            } else {
                throw new Error(`HTTP error! status: ${response.status} for game ${gameKey}`);
            }
        } else {
            allLoadedCaughtData[gameKey] = await response.json();
        }
        console.log(`Successfully loaded caught data for ${gameKey} from server.`);
    } catch (error) {
        console.error(`Could not load caught data for ${gameKey} from server:`, error);
        console.log(`Falling back to localStorage for ${gameKey}.`);
        const localData = localStorage.getItem(`caughtPokemon-${gameKey}`);
        allLoadedCaughtData[gameKey] = localData ? JSON.parse(localData) : {};
    }
    caughtDataForCurrentGame = allLoadedCaughtData[gameKey] || {};
    localStorage.setItem(`caughtPokemon-${gameKey}`, JSON.stringify(caughtDataForCurrentGame));
}

async function saveCaughtStatus(pokemonId, isCaught) {
    const pkIdStr = pokemonId.toString();
    caughtDataForCurrentGame[pkIdStr] = isCaught;
    allLoadedCaughtData[currentGame] = { ...caughtDataForCurrentGame };
    localStorage.setItem(`caughtPokemon-${currentGame}`, JSON.stringify(caughtDataForCurrentGame));

    try {
        const response = await fetch(`/caught/${currentGame}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: pkIdStr, caught: isCaught }),
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        console.log(`Save to server for ${currentGame} successful for Pokémon ${pkIdStr}.`);
    } catch (error) {
        console.error(`Failed to save to server for ${currentGame} for Pokémon ${pkIdStr}:`, error);
    }
    if (document.getElementById('pokedexView').classList.contains('active')) renderPokedexView();
    if (document.getElementById('areaDexView').classList.contains('active')) renderAreaPokemon();
}

// --- POKEDEX VIEW ---
function renderPokedexView() {
    if (!pokedexGrid || !pokemonData) return;
    pokedexGrid.innerHTML = '';
    const searchTerm = searchInput.value.toLowerCase();
    const showUncaught = showUncaughtOnlyCheckbox.checked;

    const filteredPokemon = pokemonForGame(currentGame).filter(p => {
        const nameMatch = p.name.toLowerCase().includes(searchTerm) || dexNumber(p, currentGame).toString().includes(searchTerm);
        const isCaught = caughtDataForCurrentGame[p.id.toString()] || false;
        const caughtFilterMatch = !showUncaught || !isCaught;

        return nameMatch && caughtFilterMatch;
    });

    if (filteredPokemon.length === 0) {
        pokedexGrid.innerHTML = `<p class="col-span-full text-center text-gray-500">No Pokémon match your criteria.</p>`;
        updateNextToCatchHighlight();
        return;
    }

    filteredPokemon.forEach(pokemon => {
        const card = createPokemonCard(pokemon, currentGame, caughtDataForCurrentGame, saveCaughtStatus, showModal);
        pokedexGrid.appendChild(card);
    });
    updateNextToCatchHighlight();
}

function createPokemonCard(pokemon, gameKey, caughtData, onCaughtChange, onInfoClick) {
    const card = document.createElement('div');
    card.className = 'pokemon-card';
    card.dataset.id = pokemon.id;

    const isCaught = caughtData[pokemon.id.toString()] || false;
    const availabilityInfo = pokemon.availability[gameKey];

    const spriteImg = document.createElement('img');
    spriteImg.src = pokemon.sprite;
    spriteImg.alt = pokemon.name;
    spriteImg.className = 'pokemon-sprite mb-1';
    spriteImg.onerror = function() { this.src = `https://placehold.co/72x72/e0e0e0/757575?text=${pokemon.id}`; this.alt = 'Sprite not found';};

    const nameEl = document.createElement('h3');
    nameEl.className = 'text-md font-semibold text-gray-700 text-center leading-tight';
    nameEl.textContent = `${formatDexNumber(pokemon, gameKey)} ${pokemon.name}`;

    const typesContainer = document.createElement('div');
    typesContainer.className = 'flex flex-wrap justify-center my-1';
    pokemon.types.forEach(type => {
        const typeBadge = document.createElement('span');
        typeBadge.className = `type-badge type-${type.toLowerCase()}`;
        typeBadge.textContent = type;
        typesContainer.appendChild(typeBadge);
    });

    const caughtLabel = document.createElement('label');
    caughtLabel.className = 'flex items-center mt-1 cursor-pointer text-sm text-gray-600';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'caught-checkbox form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500';
    checkbox.checked = isCaught;
    checkbox.dataset.pokemonId = pokemon.id;
    checkbox.onchange = (e) => {
        onCaughtChange(e.target.dataset.pokemonId, e.target.checked);
    };
    caughtLabel.appendChild(checkbox);
    const caughtText = document.createElement('span');
    caughtText.textContent = ' Caught';
    caughtText.className = 'ml-1.5';
    caughtLabel.appendChild(caughtText);

    const infoButtonEl = document.createElement('button');
    infoButtonEl.className = 'info-button bg-blue-500 hover:bg-blue-700 text-white font-bold';
    infoButtonEl.textContent = 'Info';
    infoButtonEl.onclick = () => onInfoClick(pokemon, gameKey);

    card.appendChild(spriteImg);
    card.appendChild(nameEl);
    card.appendChild(typesContainer);

    if (availabilityInfo && !availabilityInfo.catchable && availabilityInfo.note) {
        const availNoteEl = document.createElement('p');
        availNoteEl.className = 'availability-note text-center text-xs';
        availNoteEl.textContent = availabilityInfo.note.length > 40 ? availabilityInfo.note.substring(0, 37) + "..." : availabilityInfo.note;
        card.appendChild(availNoteEl);
    }

    const [bestRoute] = specialRoutesFor(pokemon, gameKey);
    if (bestRoute) {
        const routeBadge = document.createElement('span');
        if (bestRoute.kind === 'event') {
            routeBadge.className = 'event-badge';
            routeBadge.textContent = 'Self-host event';
            routeBadge.title = 'Event only, but you can recreate the event with your own saves. Click Info for how.';
        } else {
            routeBadge.className = 'glitch-badge';
            routeBadge.textContent = 'Glitch method';
            routeBadge.title = 'Only obtainable via a glitch in this game. Click Info for how.';
        }
        card.appendChild(routeBadge);
    }

    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'flex items-center justify-between w-full mt-1';
    controlsContainer.appendChild(caughtLabel)
    controlsContainer.appendChild(infoButtonEl);
    card.appendChild(controlsContainer);

    return card;
}

function updateNextToCatchHighlight() {
    if (!pokedexGrid) return;
    document.querySelectorAll('.next-to-catch').forEach(el => el.classList.remove('next-to-catch'));
    if (showUncaughtOnlyCheckbox.checked || searchInput.value.trim() !== '') return;

    const cards = pokedexGrid.querySelectorAll('.pokemon-card');
    for (const card of cards) {
        if (!caughtDataForCurrentGame[card.dataset.id.toString()]) {
            card.classList.add('next-to-catch');
            break;
        }
    }
}

// --- MODAL ---
function showModal(pokemon, gameKey) {
    if (!modal) return;
    modalPokemonName.textContent = `${formatDexNumber(pokemon, gameKey)} ${pokemon.name}`;
    modalPokemonSprite.src = pokemon.sprite;
    modalPokemonSprite.onerror = function() { this.src = `https://placehold.co/96x96/e0e0e0/757575?text=${pokemon.id}`; this.alt = 'Sprite not found';};

    const catchInfo = pokemon.getCatchInfoForGame(gameKey);
    modalCatchInfo.innerHTML = catchInfo.replace(/\n/g, '<br>');

    const availabilityInfo = pokemon.availability[gameKey];
    if (availabilityInfo && !availabilityInfo.catchable && availabilityInfo.note) {
        modalAvailabilityNote.textContent = `Note for ${gameKey}: ${availabilityInfo.note}`;
        modalAvailabilityNote.style.display = 'block';
    } else if (availabilityInfo && availabilityInfo.catchable && availabilityInfo.note) {
         modalAvailabilityNote.textContent = `Note for ${gameKey}: ${availabilityInfo.note}`;
         modalAvailabilityNote.style.display = 'block';
    } else {
        modalAvailabilityNote.style.display = 'none';
    }
    renderSpecialRoutes(specialRoutesFor(pokemon, gameKey));
    modal.style.display = "flex";
}
function renderSpecialRoutes(routes) {
    const container = document.getElementById('modalGlitchInfo');
    if (!container) return;
    container.innerHTML = '';
    container.style.display = routes.length ? 'block' : 'none';
    routes.forEach((route, i) => renderSpecialRoute(container, route, i > 0));
}
function renderSpecialRoute(container, route, isAlternative) {
    const addText = (tag, className, text) => {
        const el = document.createElement(tag);
        el.className = className;
        el.textContent = text;
        container.appendChild(el);
    };
    const isEvent = route.kind === 'event';
    const heading = isEvent ? route.name : `Glitch method: ${route.name}`;
    addText('h3', `font-semibold ${isEvent ? 'text-teal-800' : 'text-purple-800'}${isAlternative ? ' mt-3 pt-2 border-t border-purple-200' : ''}`,
        isAlternative ? `Alternative: ${heading}` : heading);
    if (route.extra) addText('p', 'mt-1', route.extra);
    if (route.steps) addText('p', 'mt-1', route.steps);
    if (route.warning) addText('p', 'mt-1 text-red-600 italic', `⚠ ${route.warning}`);
    if (route.sources.length) {
        const list = document.createElement('p');
        list.className = 'mt-1';
        list.append('Guides: ');
        route.sources.forEach((url, i) => {
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'text-blue-600 underline break-all';
            link.textContent = new URL(url).hostname + new URL(url).pathname;
            if (i > 0) list.append(', ');
            list.appendChild(link);
        });
        container.appendChild(list);
    }
}

function closeModal() { if (modal) modal.style.display = "none"; }

// --- AREA DEX ---
function initializeAreaDex() {
    if (!areaGameSelector || !pokemonData) return;
    const selectedGame = areaGameSelector.value || currentGame;
    if(areaGameSelector.value !== selectedGame && Array.from(areaGameSelector.options).find(opt => opt.value === selectedGame && !opt.disabled)) {
        areaGameSelector.value = selectedGame;
    }
    populateAreaSelector(selectedGame);
    renderAreaPokemon();
}

function handleAreaGameChange() {
    if (!areaGameSelector) return;
    const selectedGame = areaGameSelector.value;
    populateAreaSelector(selectedGame);
    renderAreaPokemon();
}

function populateAreaSelector(gameKey) {
    if (!areaSelector || !pokemonData) return;
    areaSelector.innerHTML = '<option value="">-- Select Area --</option>';
    if (!allGameLocations[gameKey]) {
        const locations = new Set();
        pokemonData.forEach(p => {
            // Only consider locations for Pokémon of the correct generation for the selected game
            if (!existsInGame(p, gameKey)) return;
            if (p.availability[gameKey] && p.availability[gameKey].locations) {
                p.availability[gameKey].locations.forEach(loc => locations.add(loc.trim()));
            }
        });
        allGameLocations[gameKey] = Array.from(locations).sort();
    }

    allGameLocations[gameKey].forEach(loc => {
        const option = document.createElement('option');
        option.value = loc;
        option.textContent = loc;
        areaSelector.appendChild(option);
    });
}

async function renderAreaPokemon() {
    if (!areaPokemonGrid || !areaGameSelector || !areaSelector || !pokemonData) return;
    areaPokemonGrid.innerHTML = '';
    const selectedGame = areaGameSelector.value;
    const selectedArea = areaSelector.value;

    if (!selectedGame || !selectedArea) {
        areaPokemonGrid.innerHTML = `<p class="col-span-full text-center text-gray-500">Select a game and area.</p>`;
        return;
    }

    if (!allLoadedCaughtData[selectedGame]) {
        await loadCaughtDataForGame(selectedGame);
    }
    const currentAreaCaughtData = allLoadedCaughtData[selectedGame] || {};

    const pokemonInArea = pokemonData.filter(p => {
        if (!existsInGame(p, selectedGame)) return false;
        return p.availability[selectedGame] &&
               p.availability[selectedGame].locations &&
               p.availability[selectedGame].locations.includes(selectedArea) &&
               p.availability[selectedGame].catchable;
    }).sort((a, b) => {
        // In a regional dex, Pokémon outside it (shown with national numbers) go last.
        const aIn = !!regionalNumber(a, selectedGame), bIn = !!regionalNumber(b, selectedGame);
        if (usesRegionalDex(selectedGame) && aIn !== bIn) return aIn ? -1 : 1;
        return dexNumber(a, selectedGame) - dexNumber(b, selectedGame);
    });

    if (pokemonInArea.length === 0) {
        areaPokemonGrid.innerHTML = `<p class="col-span-full text-center text-gray-500">No Pokémon found in ${selectedArea} for ${areaGameSelector.options[areaGameSelector.selectedIndex].text}.</p>`;
        return;
    }

    pokemonInArea.forEach(pokemon => {
        const card = createPokemonCard(pokemon, selectedGame, currentAreaCaughtData,
            (pkId, caughtStatus) => saveCaughtStatusForSpecificGame(selectedGame, pkId, caughtStatus),
            showModal);
        areaPokemonGrid.appendChild(card);
    });
}

async function saveCaughtStatusForSpecificGame(gameKey, pokemonId, isCaught) {
    const pkIdStr = pokemonId.toString();
    if (!allLoadedCaughtData[gameKey]) {
        allLoadedCaughtData[gameKey] = {};
    }
    allLoadedCaughtData[gameKey][pkIdStr] = isCaught;
    localStorage.setItem(`caughtPokemon-${gameKey}`, JSON.stringify(allLoadedCaughtData[gameKey]));

    try {
        const response = await fetch(`/caught/${gameKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: pkIdStr, caught: isCaught }),
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        console.log(`Save to server for ${gameKey} successful for Pokémon ${pkIdStr}.`);
    } catch (error) {
        console.error(`Failed to save to server for ${gameKey} for Pokémon ${pkIdStr}:`, error);
    }

    if (gameKey === currentGame && document.getElementById('pokedexView').classList.contains('active')) {
        renderPokedexView();
    }
    if (document.getElementById('areaDexView').classList.contains('active') && areaGameSelector.value === gameKey) {
        renderAreaPokemon();
    }
}

// --- TRADE HELPER ---
function initializeTradeHelper() {
    if (!tradeMyGameSelector || !tradePartnerGameSelector) return;
    tradeResultsPlaceholder.style.display = 'block';
    canReceiveTradesList.innerHTML = '';
    canSendTradesList.innerHTML = '';
}

async function executeTradeSearch() {
    if (!tradeMyGameSelector || !tradePartnerGameSelector || !pokemonData) return;
    tradeResultsPlaceholder.style.display = 'none';
    canReceiveTradesList.innerHTML = '<li>Loading...</li>';
    canSendTradesList.innerHTML = '<li>Loading...</li>';

    const myGameKey = tradeMyGameSelector.value;
    const partnerGameKey = tradePartnerGameSelector.value;

    if (myGameKey === partnerGameKey) {
        canReceiveTradesList.innerHTML = '<li>Please select two different games.</li>';
        canSendTradesList.innerHTML = '';
        return;
    }

    // Gen I and II can trade via the Time Capsule, but Gen III can't link with either.
    if ((gameGeneration(myGameKey) === 3) !== (gameGeneration(partnerGameKey) === 3)) {
        canReceiveTradesList.innerHTML = '<li>Gen III games (Ruby, Sapphire, Emerald, FireRed, LeafGreen) can\'t trade with Gen I or Gen II games.</li>';
        canSendTradesList.innerHTML = '';
        return;
    }

    if (!allLoadedCaughtData[myGameKey]) await loadCaughtDataForGame(myGameKey);
    if (!allLoadedCaughtData[partnerGameKey]) await loadCaughtDataForGame(partnerGameKey);

    const myCaughtData = allLoadedCaughtData[myGameKey] || {};
    const partnerCaughtData = allLoadedCaughtData[partnerGameKey] || {};

    let canReceiveHTML = '';
    let canSendHTML = '';
    let receivedCount = 0;
    let sentCount = 0;

    pokemonData.forEach(p => {
        const pkIdStr = p.id.toString();
        const iHaveIt = myCaughtData[pkIdStr] || false;
        const partnerHasIt = partnerCaughtData[pkIdStr] || false;

        // Can I receive this Pokemon? (I don't have it, partner does)
        if (!iHaveIt && partnerHasIt) {
            // I can't receive a Pokémon that doesn't exist in my game (e.g. Gen 2 into Gen 1).
            if (existsInGame(p, myGameKey) && existsInGame(p, partnerGameKey)) {
                let tradeNote = "";
                // Note about availability in my game (even if trade is possible)
                if (!p.availability[myGameKey]?.catchable && p.availability[myGameKey]?.note) {
                    tradeNote = ` <span class="text-xs italic text-gray-500">(${p.availability[myGameKey].note})</span>`;
                }
                canReceiveHTML += `<li>#${pkIdStr.padStart(3,'0')} ${p.name}${tradeNote}</li>`;
                receivedCount++;
            }
        }

        // Can I send this Pokemon? (Partner doesn't have it, I do)
        if (!partnerHasIt && iHaveIt) {
            // Partner can't receive a Pokémon that doesn't exist in their game.
            if (existsInGame(p, myGameKey) && existsInGame(p, partnerGameKey)) {
                let tradeNote = "";
                 // Note about availability in partner's game (even if trade is possible)
                if (!p.availability[partnerGameKey]?.catchable && p.availability[partnerGameKey]?.note) {
                    tradeNote = ` <span class="text-xs italic text-gray-500">(Partner needs for: ${p.availability[partnerGameKey].note})</span>`;
                }
                canSendHTML += `<li>#${pkIdStr.padStart(3,'0')} ${p.name}${tradeNote}</li>`;
                sentCount++;
            }
        }
    });

    canReceiveTradesList.innerHTML = receivedCount > 0 ? canReceiveHTML : '<li>Nothing specific found based on current caught data or game compatibility.</li>';
    canSendTradesList.innerHTML = sentCount > 0 ? canSendHTML : '<li>Nothing specific found based on current caught data or game compatibility.</li>';
}

// --- STARTUP ---
async function checkAuth() {
    loginButton = document.getElementById('loginButton');
    logoutButton = document.getElementById('logoutButton');
    userInfo = document.getElementById('userInfo');
    loginButton.onclick = () => { window.location.href = '/auth/google'; };
    logoutButton.onclick = () => { window.location.href = '/logout'; };
    try {
        const res = await fetch('/auth/user');
        if (res.ok) {
            const user = await res.json();
            userInfo.textContent = `Logged in as ${user.displayName}`;
            loginButton.classList.add('hidden');
            logoutButton.classList.remove('hidden');
            await initializeApp();
        } else {
            loginButton.classList.remove('hidden');
            logoutButton.classList.add('hidden');
        }
    } catch (err) {
        loginButton.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', checkAuth);

window.onclick = (event) => {
    if (modal && event.target == modal) {
        closeModal();
    }
};
