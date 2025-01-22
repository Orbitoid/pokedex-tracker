// script.js

// 1. On page load: fetch the 151 Pokémon from the PokéAPI
// 2. Then fetch local caught.json data to see which ones are caught
// 3. Build a checkbox list on the page
// 4. When a checkbox changes, send a POST to update caught.json

(async function () {
  const pokemonListDiv = document.getElementById("pokemon-list");

  try {
    // Fetch basic list of first 151 Pokémon
    // (Only name + url from the "results" array)
    const pokeRes = await fetch("https://pokeapi.co/api/v2/pokemon?limit=151");
    const pokeData = await pokeRes.json();
    const pokemonResults = pokeData.results; // array of { name, url }

    // Load caught data from local JSON
    const caughtRes = await fetch("/caught");
    const caughtData = await caughtRes.json(); // object { "1": true, "2": false, ... }

    // We want the ID for each Pokémon. We can extract from the URL or do a detail fetch:
    // Example: "https://pokeapi.co/api/v2/pokemon/1/" => ID = 1
    // We'll do a quick function to parse it:
    function getIdFromUrl(url) {
      // e.g. "https://pokeapi.co/api/v2/pokemon/1/"
      const parts = url.split("/").filter(Boolean);
      return parts[parts.length - 1];
    }

    // Build a simple checkbox interface
    let html = "<ul>";
    for (const p of pokemonResults) {
      const id = getIdFromUrl(p.url);
      const isCaught = !!caughtData[id];
      html += `
        <li>
          <label>
            <input
              type="checkbox"
              data-id="${id}"
              ${isCaught ? "checked" : ""}
            />
            #${id} - ${p.name}
          </label>
        </li>
      `;
    }
    html += "</ul>";
    pokemonListDiv.innerHTML = html;

    // Add event listeners to each checkbox
    const checkboxes = pokemonListDiv.querySelectorAll("input[type=checkbox]");
    checkboxes.forEach((box) => {
      box.addEventListener("change", async (e) => {
        const id = e.target.getAttribute("data-id");
        const caught = e.target.checked;
        // Send a POST request to update the server
        await fetch("/caught", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, caught }),
        }).catch(console.error);
      });
    });
  } catch (err) {
    console.error("Error loading Pokémon data or caught data:", err);
    pokemonListDiv.innerHTML = "<p>Failed to load data.</p>";
  }
})();

