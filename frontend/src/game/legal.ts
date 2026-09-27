/**
 * The two legal documents, written as data so both languages stay in step.
 *
 * They describe what this build actually does: preferences on the device, an
 * iteration saved on the server you run, no analytics, no advertising, no
 * payment path. Where a fact depends on the publisher (company name, contact),
 * the text says so instead of inventing one.
 */

import type { Localized } from './types';

export interface LegalSection {
  heading: Localized;
  body: Localized[];
}

export interface LegalDocument {
  id: 'rgpd' | 'cgu';
  title: Localized;
  summary: Localized;
  updated: Localized;
  sections: LegalSection[];
}

const t = (fr: string, en: string): Localized => ({ fr, en });

export const GDPR_DOCUMENT: LegalDocument = {
  id: 'rgpd',
  title: t('Données personnelles (RGPD)', 'Personal data (GDPR)'),
  summary: t(
    "Ce que le jeu enregistre, où, pendant combien de temps, et comment vous le reprenez ou l'effacez.",
    'What the game stores, where, for how long, and how you get it back or erase it.',
  ),
  updated: t('Version du 27 septembre 2026', 'Version of 27 September 2026'),
  sections: [
    {
      heading: t('1. Éditeur et contact', '1. Publisher and contact'),
      body: [
        t(
          "L'application est éditée par la personne ou la société qui la publie. Avant toute mise en ligne publique, l'éditeur doit remplacer les deux champs ci-dessous par ses informations réelles : elles sont laissées volontairement visibles pour qu'aucune donnée d'entreprise inventée ne soit publiée.",
          'The application is published by whoever distributes it. Before any public release the publisher must replace the two fields below with real information: they are deliberately visible so that no invented company details are published.',
        ),
        t(
          'Éditeur : à compléter avant publication. Contact pour les données personnelles : à compléter avant publication.',
          'Publisher: to be completed before release. Contact for personal data: to be completed before release.',
        ),
      ],
    },
    {
      heading: t('2. Données traitées', '2. Data processed'),
      body: [
        t(
          "Préférences de l'appareil : langue, réduction des animations, contraste, retours haptiques. Elles sont stockées uniquement sur votre appareil, dans le stockage local de l'application, et ne sont transmises à personne.",
          'Device preferences: language, reduced motion, contrast, haptics. They are stored only on your device, in the application local storage, and are never sent anywhere.',
        ),
        t(
          "Partie en cours : l'itération (cycle, habitants, décisions, interventions, sauvegarde). Elle est enregistrée sur le serveur que vous lancez, par défaut sur votre propre machine à l'adresse 127.0.0.1:8000. Si une base MongoDB est configurée, elle remplace ce fichier local.",
          'Current run: the iteration (cycle, residents, decisions, interventions, save). It is stored on the server you start, by default on your own machine at 127.0.0.1:8000. If a MongoDB database is configured, it replaces that local file.',
        ),
        t(
          "Compte (facultatif) : adresse électronique et mot de passe si vous créez un compte. Le mot de passe n'est jamais conservé en clair, il est conservé sous forme d'empreinte.",
          'Account (optional): email address and password if you create one. The password is never stored in clear text, only as a hash.',
        ),
        t(
          "Aucune mesure d'audience, aucune publicité, aucun cookie de suivi, aucune revente de données. Le jeu n'utilise pas de service tiers d'analyse.",
          'No analytics, no advertising, no tracking cookie, no resale of data. The game uses no third-party analytics service.',
        ),
      ],
    },
    {
      heading: t('3. Finalité et base légale', '3. Purpose and legal basis'),
      body: [
        t(
          "Les données servent uniquement à faire fonctionner le jeu : afficher votre partie, la reprendre plus tard, et respecter vos préférences d'affichage. La base légale est l'exécution du service que vous demandez en utilisant l'application.",
          'The data is used only to run the game: show your run, resume it later, and honour your display preferences. The legal basis is performance of the service you request by using the application.',
        ),
      ],
    },
    {
      heading: t('4. Durée de conservation', '4. Retention'),
      body: [
        t(
          "La partie en cours est conservée jusqu'à ce que vous utilisiez « Réinitialiser l'itération » dans les réglages. Les préférences restent sur l'appareil jusqu'à leur modification ou la désinstallation de l'application.",
          'The current run is kept until you use "Reset the iteration" in the settings. Preferences stay on the device until you change them or uninstall the application.',
        ),
      ],
    },
    {
      heading: t('5. Vos droits', '5. Your rights'),
      body: [
        t(
          "Vous disposez des droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité.",
          'You have the rights of access, rectification, erasure, restriction, objection and portability.',
        ),
        t(
          "Ils sont exerçables directement dans l'application : « Exporter la sauvegarde » copie l'intégralité de vos données de jeu au format JSON (portabilité et accès), « Importer une sauvegarde » les remet en place (rectification), et « Réinitialiser l'itération » les efface (effacement). Pour toute autre demande, utilisez le contact indiqué au point 1.",
          'You can exercise them directly in the application: "Export the save" copies all your game data as JSON (portability and access), "Import a save" restores it (rectification), and "Reset the iteration" erases it (erasure). For any other request, use the contact given in point 1.',
        ),
      ],
    },
    {
      heading: t('6. Sécurité et destinataires', '6. Security and recipients'),
      body: [
        t(
          "Les données ne sont communiquées à personne d'autre qu'à vous. Le serveur que vous lancez écrit la sauvegarde dans un fichier de votre machine ; les échanges avec ce serveur restent locaux par défaut. Aucun prestataire de paiement n'intervient, les achats étant désactivés dans cette version.",
          'The data is shared with nobody but you. The server you start writes the save to a file on your machine; exchanges with that server stay local by default. No payment provider is involved, since purchasing is disabled in this build.',
        ),
      ],
    },
    {
      heading: t('7. Mineurs', '7. Minors'),
      body: [
        t(
          "Le jeu raconte une ville simulée et s'adresse à un public adolescent ou adulte. Il ne comporte ni messagerie entre joueurs, ni contenu généré par d'autres utilisateurs.",
          'The game tells the story of a simulated city and targets a teenage or adult audience. It has no messaging between players and no content generated by other users.',
        ),
      ],
    },
    {
      heading: t('8. Réclamation', '8. Complaints'),
      body: [
        t(
          "Vous pouvez introduire une réclamation auprès de l'autorité de contrôle de votre pays, en France la CNIL (cnil.fr).",
          'You may lodge a complaint with the supervisory authority of your country, in France the CNIL (cnil.fr).',
        ),
      ],
    },
  ],
};

export const TERMS_DOCUMENT: LegalDocument = {
  id: 'cgu',
  title: t("Conditions générales d'utilisation", 'Terms of use'),
  summary: t(
    "Ce que vous acceptez en utilisant l'application, et ce que l'application s'engage à faire.",
    'What you accept by using the application, and what the application commits to do.',
  ),
  updated: t('Version du 27 septembre 2026', 'Version of 27 September 2026'),
  sections: [
    {
      heading: t('1. Objet', '1. Subject'),
      body: [
        t(
          "ARCADIA-9 est un jeu de simulation : vous observez six habitants d'une ville simulée, faites avancer les cycles et dépensez du Flux pour intervenir. L'édition et l'hébergement relèvent de l'éditeur nommé au point 1 de la page RGPD.",
          'ARCADIA-9 is a simulation game: you watch six residents of a simulated city, advance cycles and spend Flux to intervene. Publishing and hosting belong to the publisher named in point 1 of the GDPR page.',
        ),
      ],
    },
    {
      heading: t('2. Accès au service', '2. Access to the service'),
      body: [
        t(
          "L'application peut être utilisée sans compte. Un compte, lorsqu'il est disponible, sert uniquement à retrouver une partie. Vous êtes responsable de la confidentialité de vos identifiants.",
          'The application can be used without an account. An account, when available, only serves to find a run again. You are responsible for keeping your credentials confidential.',
        ),
      ],
    },
    {
      heading: t('3. Usage acceptable', '3. Acceptable use'),
      body: [
        t(
          "L'usage est personnel. Sont interdits : tenter de perturber le service, extraire massivement son contenu, le revendre, le présenter comme votre œuvre, ou l'utiliser pour porter atteinte à des personnes.",
          'Use is personal. Prohibited: attempting to disrupt the service, extracting its content in bulk, reselling it, presenting it as your own work, or using it to harm people.',
        ),
      ],
    },
    {
      heading: t('4. Propriété intellectuelle', '4. Intellectual property'),
      body: [
        t(
          "ARCADIA-9 est une œuvre originale : habitants, objectifs, interventions, dilemmes, textes et éléments graphiques ont été créés pour ce projet. La référence d'ambiance citée par le projet n'a servi que d'inspiration de haut niveau, aucun personnage, texte, image ou élément protégé n'en est repris.",
          'ARCADIA-9 is an original work: residents, goals, interventions, dilemmas, texts and graphic elements were created for this project. The mood reference cited by the project served only as high-level inspiration; no character, text, image or protected element is taken from it.',
        ),
      ],
    },
    {
      heading: t('5. Achats', '5. Purchases'),
      body: [
        t(
          "Aucun paiement n'est possible dans cette version. Les offres affichées dans l'onglet « Soutenir » sont descriptives, sans prix, et n'accordent aucun avantage de jeu. Le jeu s'interdit le paiement pour progresser, les monnaies premium, les boîtes surprise, les limites d'énergie artificielles et la publicité.",
          'No payment is possible in this build. The offers shown in the "Support" tab are descriptive, unpriced, and grant no gameplay advantage. The game forbids paying to progress, premium currencies, loot boxes, artificial energy limits and advertising.',
        ),
      ],
    },
    {
      heading: t('6. Disponibilité et garanties', '6. Availability and warranties'),
      body: [
        t(
          "Le service est fourni en l'état, sans garantie de disponibilité ni de conservation. Une itération peut être perdue si la sauvegarde est effacée ; utilisez « Exporter la sauvegarde » pour conserver une copie.",
          'The service is provided as is, with no warranty of availability or retention. A run can be lost if the save is erased; use "Export the save" to keep a copy.',
        ),
      ],
    },
    {
      heading: t('7. Responsabilité', '7. Liability'),
      body: [
        t(
          "La responsabilité de l'éditeur ne peut être engagée pour un dommage indirect lié à l'utilisation du jeu, dans les limites permises par la loi applicable.",
          'The publisher cannot be held liable for indirect damage linked to use of the game, within the limits allowed by applicable law.',
        ),
      ],
    },
    {
      heading: t('8. Données personnelles', '8. Personal data'),
      body: [
        t(
          "Le traitement des données est décrit dans la page « Données personnelles (RGPD) », accessible depuis les réglages et depuis le pied de page.",
          'Data processing is described on the "Personal data (GDPR)" page, reachable from the settings and from the footer.',
        ),
      ],
    },
    {
      heading: t('9. Modification des conditions', '9. Changes to the terms'),
      body: [
        t(
          "Ces conditions peuvent évoluer avec le jeu. La date en tête de page indique la version en vigueur ; continuer à jouer après une mise à jour vaut acceptation.",
          'These terms may change with the game. The date at the top of the page shows the version in force; continuing to play after an update means accepting it.',
        ),
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS = { rgpd: GDPR_DOCUMENT, cgu: TERMS_DOCUMENT };
