const searchForm = document.getElementById("search-form");
const wordInput = document.getElementById("word-input");
const statusMessage = document.getElementById("status-message");
const resultsSection = document.getElementById("results-section");
const resultWord = document.getElementById("result-word");
const phonetic = document.getElementById("phonetic");
const meaningContainer = document.getElementById("meaning-container");
const detailsContainer = document.getElementById("details-container");
const audioButton = document.getElementById("audio-button");
const favoriteButton = document.getElementById("favorite-button");
const favoritesEmpty = document.getElementById("favorites-empty");
const favoriteList = document.getElementById("favorite-list");

wordInput.addEventListener("input", () => {
    statusMessage.textContent = "";
});

let currentWord = "";
let favorites = [];

try {
    favorites = JSON.parse(localStorage.getItem("wordly-favorites") || "[]");
} catch {
    favorites = [];
}

try {
    const savedWord = sessionStorage.getItem("wordly-current-word") || "";
    wordInput.value = savedWord;
} catch {
    // Keep the search working if browser storage is blocked.
}

function saveFavorites() {
    try {
        localStorage.setItem("wordly-favorites", JSON.stringify(favorites));
    } catch {
        // Favourites still work for this page when browser storage is blocked.
    }
}

function saveCurrentWord(word) {
    try {
        sessionStorage.setItem("wordly-current-word", word);
    } catch {
        // The search does not depend on session storage.
    }
}

function showFavorites() {
    favoriteList.replaceChildren();
    favoritesEmpty.hidden = favorites.length > 0;

    favorites.forEach((word) => {
        const item = document.createElement("li");
        item.className = "favorite-item";

        const wordText = document.createElement("span");
        wordText.textContent = word;

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.textContent = "Remove";
        removeButton.addEventListener("click", () => {
            favorites = favorites.filter((favorite) => favorite !== word);
            saveFavorites();
            showFavorites();
            updateFavoriteButton();
        });

        item.append(wordText, removeButton);
        favoriteList.append(item);
    });
}

function updateFavoriteButton() {
    const isFavorite = favorites.includes(currentWord);
    favoriteButton.textContent = isFavorite ? "Remove from favourites" : "Add to favourites";
}

favoriteButton.addEventListener("click", () => {
    if (favorites.includes(currentWord)) {
        favorites = favorites.filter((word) => word !== currentWord);
    } else {
        favorites.push(currentWord);
    }

    saveFavorites();
    showFavorites();
    updateFavoriteButton();
});

function makeDetail(title, values) {
    if (!values.length) return;
    const titleText = document.createElement("strong");
    titleText.textContent = `${title}: `;
    const paragraph = document.createElement("p");
    paragraph.append(titleText, values.join("; "));
    detailsContainer.append(paragraph);
}

searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const word = wordInput.value.trim();

    if (!word) {
        statusMessage.textContent = "";
        return;
    }

    statusMessage.textContent = "Searching for your word...";

    try {
        const fallbackUrl = `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d&qe=sp&max=1`;
        const fallbackResponse = await fetch(fallbackUrl);
        if (!fallbackResponse.ok) {
            throw new Error("Dictionary service unavailable. Please try again later.");
        }

        const [fallbackEntry] = await fallbackResponse.json();
        if (!fallbackEntry?.defs || fallbackEntry.word !== word) {
            throw new Error("Word not found. Please try another word.");
        }

        const relatedResponse = await fetch(
            `https://api.datamuse.com/words?ml=${encodeURIComponent(word)}&md=d&qe=ml&max=8`
        );
        const relatedWords = relatedResponse.ok
            ? (await relatedResponse.json()).map((item) => item.word)
            : [];

        const entry = {
            word: fallbackEntry.word,
            phonetic: "",
            phonetics: [],
            meanings: fallbackEntry.defs.map((definition) => {
                const [partOfSpeech, text] = definition.split("\t", 2);
                const labels = { n: "noun", v: "verb", adj: "adjective", adv: "adverb" };
                return {
                    partOfSpeech: labels[partOfSpeech] || partOfSpeech,
                    synonyms: relatedWords,
                    definitions: [{ definition: text }]
                };
            })
        };

        currentWord = entry.word;
        saveCurrentWord(currentWord);
        resultWord.textContent = entry.word;
        phonetic.textContent = entry.phonetic || entry.phonetics.find((item) => item.text)?.text || "";

        meaningContainer.replaceChildren();
        entry.meanings.forEach((meaning) => {
            meaning.definitions.forEach((definition) => {
                const item = document.createElement("p");
                item.textContent = `${meaning.partOfSpeech}: ${definition.definition}`;
                meaningContainer.append(item);
            });
        });

        detailsContainer.replaceChildren();
        const examples = entry.meanings.flatMap((meaning) => meaning.definitions
            .filter((definition) => definition.example)
            .map((definition) => definition.example));
        const synonyms = entry.meanings.flatMap((meaning) => [
            ...meaning.synonyms || [],
            ...meaning.definitions.flatMap((definition) => definition.synonyms || [])
        ]);
        const antonyms = entry.meanings.flatMap((meaning) => [
            ...meaning.antonyms || [],
            ...meaning.definitions.flatMap((definition) => definition.antonyms || [])
        ]);

        makeDetail("Examples", examples);
        makeDetail("Synonyms", [...new Set(synonyms)]);
        makeDetail("Antonyms", [...new Set(antonyms)]);
        makeDetail("Origin", entry.origin ? [entry.origin] : []);

        const pronunciation = entry.phonetics.find((item) => item.audio)?.audio;
        audioButton.hidden = !(pronunciation || "speechSynthesis" in window);
        audioButton.onclick = () => {
            if (pronunciation) {
                new Audio(pronunciation).play();
            } else {
                window.speechSynthesis.speak(new SpeechSynthesisUtterance(entry.word));
            }
        };

        favoriteButton.hidden = false;
        updateFavoriteButton();
        resultsSection.hidden = false;
        statusMessage.textContent = "";
    } catch (error) {
        resultsSection.hidden = true;
        statusMessage.textContent = error.message;
    }
});

showFavorites();

