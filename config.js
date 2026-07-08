// ===================================================================
//  Cle Google — OCR de l'ecriture manuscrite par IA (pour tous les visiteurs).
//  Le moteur "OCR avance" utilise Gemini (IA qui comprend le tchetchene),
//  avec Cloud Vision en secours.
//
//  La cle est publique dans le code : protegez-la cote Google par
//    1) une restriction de site : noxchiynmott.com/*
//    2) des API autorisees : "Generative Language API" ET "Cloud Vision API"
//    3) un plafond de depense (alerte de budget)
//  L'app limite en plus a 15 OCR avances par session.
//
//  >>> Collez votre cle entre les guillemets ci-dessous, puis televersez ce fichier. <<<
// ===================================================================
window.NM_VISION_KEY = "AIzaSyCP8QF_3vCE2m6jRenhN_Y8GfVKDgO6Aa0";

// Modele IA utilise (laisser tel quel ; a changer seulement si Google le renomme un jour)
window.NM_OCR_MODEL = "gemini-2.5-flash";
