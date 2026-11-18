// ===================================================================
//  Configuration publique de Noxchiyn Mott.
//
//  IMPORTANT : ce fichier est visible par tout le monde.
//  Il ne doit JAMAIS contenir de cle API.
//
//  La cle Gemini vit uniquement dans le relais Cloudflare (worker.js),
//  ou elle est stockee comme secret et reste invisible.
//  Ici on ne met que l'adresse publique du relais, qui est inoffensive.
//
//  >>> Collez l'adresse de votre Worker entre les guillemets. <<<
//      exemple : https://noxchiyn-relais.VOTRE-NOM.workers.dev
// ===================================================================
window.NM_API_URL = "";

// Adresse qui recoit les signalements de "mauvaise traduction"
window.NM_REPORT_EMAIL = "mar22o@proton.me";
