import { type Cell, type IsoDate, type Meal, ROME_TZ, toUtcDate } from '@/lib/dates'

export const mealName: Record<Meal, string> = { lunch: 'Pranzo', dinner: 'Cena' }
export const mealNameLower: Record<Meal, string> = { lunch: 'pranzo', dinner: 'cena' }

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

const shortFmt = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const longFmt = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const dateTimeFmt = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: ROME_TZ,
})

export function formatDayShort(iso: IsoDate): string {
  return shortFmt.format(toUtcDate(iso))
}
export function formatDayLong(iso: IsoDate): string {
  return longFmt.format(toUtcDate(iso))
}
/** ISO timestamp (timestamptz) → 'gg/mm/aaaa, hh:mm' in Rome time. */
export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso))
}

function toMeal(m: Meal): string {
  return m === 'lunch' ? 'al pranzo' : 'alla cena'
}

export function intervalSummary(cells: Cell[]): string {
  if (cells.length === 0) return 'Nessun pasto'
  const a = cells[0]
  const b = cells[cells.length - 1]
  if (cells.length === 1) return `1 pasto: ${mealNameLower[a.meal]} di ${formatDayShort(a.date)}`
  return `${plural(cells.length, 'pasto', 'pasti')}, dal ${mealNameLower[a.meal]} di ${formatDayShort(a.date)} ${toMeal(b.meal)} di ${formatDayShort(b.date)}`
}

export function stateLabel(state: boolean): string {
  return state ? 'Presente' : 'Assente'
}

export function kindLabel(kind: string): string {
  return ({ toggle: 'Singolo pasto', interval: 'Periodo', admin_edit: 'Modifica cucina', undo: 'Annullamento' } as Record<string, string>)[kind] ?? kind
}

export const t = {
  appName: 'PSRM Pasti',
  save: 'Salva',
  cancel: 'Annulla',
  close: 'Chiudi',
  edit: 'Modifica',
  delete: 'Elimina',
  confirmDelete: 'Confermi?',
  yes: 'Sì',
  no: 'No',
  loading: 'Attendere…',
  genericError: 'Si è verificato un errore, riprova.',
  retry: 'Riprova',
  absentCount: (n: number) => plural(n, 'assente', 'assenti'),
  presentCount: (n: number) => plural(n, 'presente', 'presenti'),
  member: {
    today: 'Oggi',
    seasonPresent: 'In questo periodo sei presente salvo diversa indicazione.',
    seasonAbsent: 'In questo periodo sei assente salvo diversa indicazione.',
    lockedAt: (hm: string) => `chiuso alle ${hm}`,
    saved: 'Salvato',
    saveError: 'Errore nel salvataggio, riprova.',
    lockedError: 'Questo pasto è già chiuso alle modifiche.',
    markPeriod: 'Segna un periodo',
    explicitHint: 'Il puntino indica una scelta diversa dal periodo.',
    notes: {
      title: 'Note alimentari',
      hint: 'Allergie, intolleranze o altre esigenze: la cucina le vede.',
      empty: 'Nessuna nota.',
      placeholder: 'Es. celiachia, intolleranza al lattosio…',
    },
  },
  period: {
    title: 'Segna un periodo',
    absent: 'Assente',
    present: 'Presente',
    from: 'Dal',
    to: 'Al',
    invalidInterval: 'La fine deve essere dopo l’inizio.',
    tooLong: 'Periodo troppo lungo.',
    startTooEarly: 'Il pranzo di oggi è già chiuso: scegli la cena.',
    lockedError: 'Alcuni pasti sono già chiusi alle modifiche.',
    confirmTitle: 'Salvato',
    confirmKitchen: 'La cucina vede subito questa modifica.',
    overwrittenTitle: 'Scelte precedenti sostituite',
    overwrittenMore: (n: number) => `+${plural(n, 'altro', 'altri')}`,
    noOverwritten: 'Nessuna scelta precedente è stata sostituita.',
    was: 'era',
    undo: 'Annulla',
    undone: 'Modifica annullata.',
    backToList: 'Torna all’elenco',
    undoReason: {
      not_found: 'Modifica non trovata.',
      already_undone: 'Modifica già annullata.',
      too_old: 'Sono passate più di 24 ore.',
      superseded: 'Ci sono modifiche più recenti su questi pasti.',
      not_undoable: 'Questa modifica non può essere annullata.',
      locked: 'I pasti di questa modifica sono già chiusi alle modifiche.',
    } as Record<string, string>,
  },
  invalidLink: { title: 'Link non valido', body: 'Chiedi in cucina un nuovo link.' },
  offline: { title: 'Sei offline', body: 'Controlla la connessione e riprova.' },
  admin: {
    login: 'Accedi',
    email: 'Email',
    password: 'Password',
    loginError: 'Email o password non validi.',
    showPassword: 'Mostra password',
    hidePassword: 'Nascondi password',
    forgotPassword: 'Password dimenticata?',
    reset: {
      title: 'Reimposta la password',
      intro: 'Inserisci l’email del tuo account: ti invieremo un link per scegliere una nuova password.',
      submit: 'Invia il link',
      sent: 'Se l’indirizzo è registrato, riceverai un’email con il link per reimpostare la password.',
      newTitle: 'Scegli una nuova password',
      invalidLink: 'Link non valido o scaduto.',
      requestAgain: 'Richiedi un nuovo link',
      goToKitchen: 'Vai alla cucina',
      backToLogin: 'Torna all’accesso',
    },
    notAdmin: 'Questo account non è abilitato come amministratore.',
    logout: 'Esci',
    nav: { kitchen: 'Cucina', persons: 'Persone', seasons: 'Stagioni', settings: 'Impostazioni', log: 'Registro', password: 'Password' },
    changePassword: {
      title: 'Cambia password',
      current: 'Password attuale',
      next: 'Nuova password',
      confirm: 'Conferma nuova password',
      submit: 'Aggiorna password',
      tooShort: 'La nuova password deve avere almeno 8 caratteri.',
      mismatch: 'Le due password non coincidono.',
      wrongCurrent: 'Password attuale non corretta.',
      saved: 'Password aggiornata.',
    },
    kitchen: {
      title: 'Cucina',
      prevDay: 'Giorno precedente',
      nextDay: 'Giorno successivo',
      go: 'Vai',
      community: 'Comunità',
      guests: 'Ospiti',
      total: 'Totale',
      guestNote: 'Nota ospiti',
      absentAt: (meal: string) => `Assenti a ${meal}`,
      presentAt: (meal: string) => `Presenti a ${meal}`,
      nobody: 'Nessuno',
      showAll: 'Mostra tutti',
      showExceptions: 'Mostra solo eccezioni',
      defaultPresent: 'periodo a presenza predefinita',
      defaultAbsent: 'periodo ad assenza predefinita',
      print: 'Stampa',
      dietaryNotes: 'Note alimentari',
    },
    persons: {
      title: 'Persone',
      new: 'Nuova persona',
      name: 'Nome e cognome',
      group: 'Gruppo',
      dietaryNotes: 'Note alimentari',
      active: 'Attivo',
      inactive: 'Disattivato',
      status: 'Stato',
      lastChange: 'Ultima modifica',
      never: 'mai',
      deactivate: 'Disattiva',
      activate: 'Attiva',
      regenerate: 'Rigenera link',
      copyLink: 'Copia link',
      copied: 'Copiato',
      qr: 'QR',
      linkOnce: 'Questo link è visibile solo ora: copialo o mostra il QR.',
      cannotDelete: 'Ha delle modifiche registrate: puoi solo disattivarla.',
    },
    seasons: {
      title: 'Stagioni',
      label: 'Nome',
      recurring: 'Ogni anno',
      oneOff: 'Date specifiche',
      kind: 'Tipo',
      period: 'Periodo',
      startMd: 'Inizio (MM-GG)',
      endMd: 'Fine (MM-GG)',
      startDate: 'Inizio',
      endDate: 'Fine',
      lunchDefault: 'Pranzo predefinito',
      dinnerDefault: 'Cena predefinita',
      add: 'Aggiungi stagione',
      hint: 'Le date specifiche vincono sulle stagioni annuali; tra date specifiche vince la più breve.',
    },
    settings: {
      title: 'Impostazioni',
      lunchCutoff: 'Chiusura modifiche pranzo',
      dinnerCutoff: 'Chiusura modifiche cena',
      saved: 'Impostazioni salvate.',
    },
    log: {
      title: 'Registro',
      person: 'Persona',
      all: 'Tutte',
      from: 'Dal',
      to: 'Al',
      filter: 'Filtra',
      when: 'Quando',
      actor: 'Chi',
      actorMember: 'persona',
      actorAdmin: 'cucina',
      kind: 'Tipo',
      interval: 'Pasti',
      state: 'Stato',
      undone: 'annullata',
      empty: 'Nessuna modifica trovata.',
    },
  },
}
