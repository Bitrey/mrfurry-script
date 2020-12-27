let maxLogs = false;

const log = (text, isError, isImportant) => {
    const textParagraph = document.createElement("p");
    textParagraph.textContent = `> ${text}`;
    if (isError) textParagraph.style.color = "red";
    if (isImportant) textParagraph.style.fontWeight = 600;
    const consoleElem = document.getElementById("console");
    consoleElem.append(textParagraph);

    if (document.getElementById("autoscroll").checked) {
        consoleElem.scrollTop = consoleElem.scrollHeight;
    }

    // Delete old ones
    if (consoleElem.childElementCount > 100) {
        consoleElem.children.item(0).remove();
        if (!maxLogs) {
            maxLogs = true;
            log("Numero massimo di log raggiunto, gli ultimi verranno rimossi");
        }
    }

    console.log(text);
};

let elapsedSeconds;

const socket = io();

const main = async () => {
    log("Pagina caricata");

    emitData();

    updateSlider();

    elapsedSeconds = 0;
    setInterval(() => {
        elapsedSeconds++;
        document.getElementById("data").textContent = getSecStr(elapsedSeconds);
        log("Aggiorno secondi a " + elapsedSeconds);
    }, 1000);

    socket.on("data", async data => {
        log("SOCKET.IO RICEVUTI DATI: " + JSON.stringify(data), false, true);

        document.getElementById("loading-info").style.display = "none";

        const clientDate = new Date();
        const secDiff =
            new Date(data.date).getUTCSeconds() - clientDate.getUTCSeconds();
        elapsedSeconds = secDiff;

        minPrice = data.alertNum;

        document.getElementById("url").textContent = data.amazonUrl;
        document.getElementById("url").href = data.amazonUrl;
        document.getElementById("prezzo").textContent = data.currentPrice + "€";
        document.getElementById("max").textContent = data.alertNum + "€";
        // document.getElementById("minore").textContent = data.isBelowMin;
        document.getElementById("data").textContent = getSecStr(secDiff);
        document.getElementById("errore").textContent = "null";

        document.getElementById("data-div").style.color = "green";
        setTimeout(() => {
            document.getElementById("data-div").style.color = "black";
        }, 200);

        document.getElementById("data-div").style.display = "block";

        const isBelowMin = data.isBelowMin || data.currentPrice < data.alertNum;
        document.getElementById("minore").textContent = isBelowMin;

        if (isBelowMin) {
            log("PREZZO SOTTO MINIMO");
            startAlert();
        } else log("prezzo non sotto minimo");

        // resetWatchdog();

        log(`Aspetto ${waitTime}ms...`);
        currentWaitTime = waitTime;
        await wait(waitTime);
        log(`Ho aspettato ${currentWaitTime}ms`);

        isMakingRequest = false;
        emitData();
    });

    socket.on("error", async err => {
        log("ERRORE: " + JSON.stringify(err), true, true);

        document.getElementById("errore").textContent = err?.message;
        document.getElementById("loading-info").style.display = "none";
        document.getElementById("data-div").style.display = "none";

        document.getElementById("errore").style.color = "red";
        setTimeout(() => {
            document.getElementById("errore").style.color = "black";
        }, 200);

        // resetWatchdog();

        currentWaitTime = 20000;

        log(`Aspetto 20000ms per l'errore...`);
        await wait(20000);
        log(`Ho aspettato 20000ms per l'errore`);

        isMakingRequest = false;
        emitData();
    });
};

const audio = new Audio("/audio.mp3");
log("Audio elem: " + JSON.stringify(audio));

let alertOk = false;
alert(
    "ATTENZIONE: il browser è stupido e per far partire l'audio vuole che tu interagisca con la pagina. Quindi premi il tasto sotto per fare una prova audio."
);
alertOk = true;
log("Alert ok");

const getSecStr = elapsed => {
    return `${elapsed} second${elapsed === 1 ? "o" : "i"} fa`;
};

const wait = ms => {
    return new Promise(async (resolve, reject) => {
        setTimeout(resolve, ms);
    });
};

const originalTitle = document.title;
let minPrice = 700;
const alertTitles = [
    "GPU COMPRA",
    "SUBITO",
    "ADESSO",
    "AMAZON",
    "RTX 3070",
    "SOTTO €" + minPrice
];
let shouldAlert = false;
const startAlert = async isTest => {
    log("Start alert", false, true);
    shouldAlert = true;
    const promise = audio.play();

    if (promise !== undefined) {
        promise.catch(error => {
            log("Errore in audio.play(): " + JSON.stringify(error), true, true);
            alert("L'audio non può partire finché non premi il tasto di prova");
        });
    }

    let hasTimeoutStarted = false;
    while (shouldAlert) {
        for (const title of alertTitles) {
            if (!shouldAlert) {
                document.title = originalTitle;
                log("Torna a titolo originale");
                break;
            }
            if (audio.ended) audio.play();
            log("Cambia titolo a " + title);
            document.title = title;
            await wait(500);
        }
        if (isTest && !hasTimeoutStarted) {
            setTimeout(stopNotification, 10000);
            hasTimeoutStarted = true;
        }
    }
};
const stopNotification = () => {
    log("Interrompo notifica");
    shouldAlert = false;
    document.title = originalTitle;
};

let waitTime = 20000;
let currentWaitTime = 20000;
const updateSlider = () => {
    const value = parseInt(document.getElementById("attesa").value);
    const str = `${value}ms (${Math.round(value / 1000)}sec)`;
    waitTime = value;
    document.getElementById("attesa-output").textContent = str;
};

const updateVolume = () => {
    const value = parseInt(document.getElementById("volume").value);
    audio.volume = value / 100;

    document.getElementById("volume-output").textContent = value + "%";
};

const emitData = () => {
    if (isMakingRequest) {
        return log("emitData rifiutato, isMakingRequest è true", true);
    }
    if (!alertOk) {
        return log("Alert is not ok", true);
    }
    // else if (isWatchgoingOn) {
    //     return log("Watchdog è già on", true);
    // }
    isMakingRequest = true;
    socket.emit("data");
    log("Socket emit data");
    // startWatchdog(socket);
};

let isMakingRequest = false;

const watchdogInterval = setInterval(() => {
    if (elapsedSeconds * 1000 > currentWaitTime + 10000) {
        log("Watchdog scaduto, forzo nuova richiesta", true);
        emitData();
    }
}, 10000);

// let watchdogErrors = 0;
// let watchdogTimeout = null;
// let isWatchgoingOn = false;
// const startWatchdog = socket => {
//     if (isWatchgoingOn) {
//         log("PROGRAM ERROR: isWatchgoingOn è già true", true);
//         return;
//     }
//     log("Watchdog iniziato");
//     isWatchgoingOn = true;
//     // Watchdog expires after current wait time + 10 seconds
//     watchdogTimeout = setTimeout(() => {
//         watchdogErrors++;
//         const vowel = watchdogErrors === 1 ? "a" : "e";
//         log(`Watchdog scaduto ${watchdogErrors} volt${vowel}`, true, true);
//         resetWatchdog(true);
//         emitData(socket);
//         isWatchgoingOn = false;
//     }, currentWaitTime + 5000);
// };

// const resetWatchdog = dontResetTimer => {
//     if (!dontResetTimer) {
//         watchdogErrors = 0;
//     }
//     clearTimeout(watchdogTimeout);
//     log("Watchdog resettato");
//     isWatchgoingOn = false;
// };
