# Messages DraftBot — LMDS+

Copie-colle dans le **dashboard DraftBot** (embeds / bienvenue / tickets).
Site : https://lmdslive.pages.dev

Variables DraftBot utiles :
- `{user}` = mention
- `{username}` = pseudo
- `{server}` = nom du serveur
- `{memberCount}` = nb de membres

---

## 1) Bienvenue (message d’arrivée)

**Titre**
```
Bienvenue sur LMDS+ 👋
```

**Description**
```
Salut {user} !

Ici on regarde le **sport en direct** — et tu peux **coffrer ton IPTV dès 9,99€**.

📺 **IPTV Premium** → ouvre un ticket dans le salon dédié
🌐 **Site matchs** → https://lmdslive.pages.dev

Lis les règles, puis rejoins le chat. Bienvenue dans la team !
```

**Footer**
```
LMDS+ · {memberCount} membres
```

---

## 2) Règles (salon règles)

**Titre**
```
📜 Règles LMDS+
```

**Description**
```
1. **Respect** — pas d’insultes, pas de harcèlement
2. **Pas de pub** — sauf autorisation staff
3. **Pas de spoil** score sans spoiler tag
4. **Tickets IPTV** — uniquement via le panneau officiel
5. **Arnaques** — paiements uniquement via les infos staff (PayPal / IBAN)

Le non-respect = warn / mute / ban.
```

---

## 3) Panneau IPTV (salon tickets / offre)

**Titre**
```
Contenu disponible
```

**Description**
```
Avec **LMDS+**, profitez d’un large catalogue de contenus et d’un accompagnement professionnel avant, pendant et après votre commande.

• Plus de **28 300** chaînes TV issues de plus de **180** pays
• Plus de **157 000** films et **50 000** séries
• Qualité disponible en **SD, HD, FHD, UHD** et **4K**
• Compatible avec la plupart des téléviseurs, ordinateurs, smartphones et appareils IPTV
• Abonnements disponibles pour **1, 3, 6** ou **12** mois

**Une expérience fluide et optimisée**
→ Infrastructure optimisée pour limiter les interruptions et les freezes
→ Diffusion stable selon votre connexion et votre appareil
→ Serveurs surveillés afin de maintenir une qualité de visionnage optimale

**Nos offres**
📅 1 mois — **10 €**
📅 3 mois — **25 €**
📅 6 mois — **45 €**
📅 12 mois — **70 €**

**Pourquoi choisir LMDS+ ?**
→ Livraison instantanée
→ Service fiable et sécurisé
→ Excellent rapport qualité / prix
→ Assistance rapide et efficace
```

**Bouton ticket (label)** — style gris (Secondary)
```
Souscrire à un abonnement
```

---

## 4) Message auto à l’ouverture du ticket

**Titre**
```
Ticket IPTV — on s’occupe de toi
```

**Description**
```
Salut {user} 👋

Merci pour ta demande **IPTV**.

 indiques ici :
1️⃣ La **durée** voulue (test 24h / 1 / 3 / 6 / 12 / 24 mois)
2️⃣ Le **paiement** (PayPal ou virement)
3️⃣ Ton **appareil** (Smart TV, Firestick, téléphone, PC…)

Le staff te répond ici. Reste sur ce salon.
```

**Footer**
```
LMDS+ IPTV
```

---

## 5) Message paiement PayPal (à coller manuellement ou en auto-réponse)

```
## Paiement PayPal

1. Paie le montant exact ici :
→ https://paypal.me/Kaaylowww

2. Envoie la **preuve de paiement** (capture) dans le ticket

3. On te génère ton **accès IPTV** 🎉
```

---

## 6) Message paiement IBAN

```
## Paiement virement

1. Virement du montant exact sur :
`FR38 3000 2050 0000 0085 7593 A21`

2. Envoie la **preuve** (capture) dans le ticket

3. On te génère ton **accès IPTV** 🎉
```

---

## 7) Message test 24h

```
## Test gratuit 24h

1. Indique ton appareil / appli (Smart TV, Firestick, téléphone…)
2. Le staff te génère un **accès test 24h**
3. Aucun paiement pour cette offre
```

---

## 8) Salon site / liens

```
## 🌐 LMDS+ — liens utiles

▶ Site matchs en direct
https://lmdslive.pages.dev

▶ Offre IPTV dès 9,99€
Ouvre un ticket dans le salon IPTV

▶ Discord
Reste connecté pour les actus & l’activation
```

---

## 9) Au revoir (départ membre) — optionnel

**Description**
```
{username} a quitté le serveur. À bientôt peut-être 👋
```

---

## Catégories tickets DraftBot (suggestion)

| Nom | Description |
|-----|-------------|
| IPTV — Commande | Achat abonnement |
| IPTV — Test 24h | Essai gratuit |
| Support | Problème technique / login |
| Autre | Question générale |

---

## Couleurs embed (hex)

- Offre IPTV : `#F59E0B` (orange)
- Bienvenue : `#3B82F6` (bleu)
- Ticket : `#A855F7` (violet)
- Règles : `#EF4444` (rouge soft)
