// Demo-only data for features that have no API in the team's agreed list yet
// (venue bookings, announcements, user accounts). Changes are kept in this
// browser only. When the backend adds these endpoints, replace these lists
// with fetch calls in api.js.
import { save, store } from './manage-ui.js'

export const FACILITIES = [
  { id: 'wu14', name: 'Warm-up track, lanes 1–4', note: '200 m, 8 lanes' },
  { id: 'wu58', name: 'Warm-up track, lanes 5–8', note: '200 m, 8 lanes' },
  { id: 'throws', name: 'Throws practice area', note: '4 seated throwing frames' },
  { id: 'jumps', name: 'Jumps practice pit', note: 'Long and triple jump' },
  { id: 'gym', name: 'Strength gym', note: 'Step-free, 12 stations' },
  { id: 'class1', name: 'Classification room 1', note: 'Panel A' },
  { id: 'repair', name: 'Wheelchair and prosthetics repair', note: '30-minute slots' },
]

const BOOKINGS = [
  ['2026-10-14', 'wu14', 'VIE', 6.5, 7.5, 'approved'], ['2026-10-14', 'wu14', 'PHI', 7.5, 8.5, 'approved'], ['2026-10-14', 'wu14', 'THA', 9, 10, 'approved'],
  ['2026-10-14', 'wu14', 'SGP', 10.5, 11.5, 'approved'], ['2026-10-14', 'wu58', 'MYA', 6, 7, 'approved'], ['2026-10-14', 'wu58', 'INA', 7, 8, 'approved'],
  ['2026-10-14', 'wu58', 'MAS', 7, 8, 'approved'], ['2026-10-14', 'wu58', 'CAM', 8.5, 9.5, 'approved'], ['2026-10-14', 'throws', 'INA', 6.5, 7.5, 'approved'],
  ['2026-10-14', 'throws', 'THA', 7.5, 8.5, 'pending'], ['2026-10-14', 'throws', 'VIE', 9, 10, 'approved'], ['2026-10-14', 'throws', 'Closed', 11, 12, 'closed'],
  ['2026-10-14', 'jumps', 'MAS', 8, 9, 'approved'], ['2026-10-14', 'jumps', 'PHI', 10, 11, 'approved'], ['2026-10-14', 'jumps', 'MYA', 11, 12, 'pending'],
  ['2026-10-14', 'gym', 'Open access', 6, 12, 'closed'], ['2026-10-14', 'class1', 'VIE', 8, 8.75, 'approved'], ['2026-10-14', 'class1', 'MYA', 9, 9.75, 'approved'],
  ['2026-10-14', 'repair', 'THA', 6.5, 7, 'approved'], ['2026-10-14', 'repair', 'MAS', 7, 7.5, 'approved'], ['2026-10-14', 'repair', 'PHI', 8, 8.5, 'approved'],
  ['2026-10-15', 'wu14', 'INA', 6.5, 7.5, 'approved'], ['2026-10-15', 'wu58', 'THA', 7, 8, 'approved'], ['2026-10-15', 'throws', 'MAS', 7, 8, 'approved'],
  ['2026-10-15', 'jumps', 'SGP', 9, 10, 'pending'], ['2026-10-15', 'gym', 'Open access', 6, 12, 'closed'],
  ['2026-10-16', 'wu14', 'CAM', 7, 8, 'approved'], ['2026-10-16', 'gym', 'Open access', 6, 12, 'closed'],
].map(([date, facility, team, start, end, status], i) => ({ id: i + 1, date, facility, team, start, end, status, by: team === 'THA' ? 'Kanya Wongsakul' : team === 'MYA' ? 'Aye Chan Moe' : team === 'SGP' ? 'Daniel Ong' : '' }))

export const getBookings = () => store('bookings', BOOKINGS)
export const saveBookings = (list) => save('bookings', list)

const ANNOUNCEMENTS = [
  { id: 5, priority: 'urgent', topic: 'Access', time: '2026-10-14T08:52', to: 'Everyone', title: 'Gate B lift out of service', th: 'ลิฟต์ประตู B ใช้งานไม่ได้', body: 'Use gate C for step-free access to the main stand. Volunteers are at gate B to help.', read: 91 },
  { id: 4, priority: 'important', topic: 'Schedule', time: '2026-10-14T07:10', to: 'Team managers', title: 'Universal relay: declare your running order by 18:30', th: '', body: 'Late declarations cannot be accepted. Declare from the team manager page.', read: 100 },
  { id: 3, priority: 'normal', topic: 'Schedule', time: '2026-10-13T15:40', to: 'Everyone', title: "Men's 1500 m T54 moves to 18:50", th: '', body: 'The call room now opens at 18:20. All other times are unchanged.', read: 86 },
  { id: 2, priority: 'normal', topic: 'Transport', time: '2026-10-13T14:05', to: 'Athletes', title: 'Evening shuttles: 16:45 and 17:30 from the athlete village', th: '', body: 'Both buses have wheelchair lifts. The last return leaves the stadium at 21:30.', read: 78 },
  { id: 1, priority: 'normal', topic: 'Information', time: '2026-10-13T09:15', to: 'Everyone', title: 'Friday marathon starts at 06:00 on the Lakeside loop', th: '', body: 'Road closures run from 05:00 to 10:30.', read: 73 },
]
export const getAnnouncements = () => store('announcements', ANNOUNCEMENTS)
export const saveAnnouncements = (list) => save('announcements', list)

const USERS = [
  ['Lim Wei Jie', 'sporter', 'MAS', 'waiting', 'Guide runner', 'Asked 08:50'], ['Farah Idris', 'sporter', 'MAS', 'waiting', 'Guide runner', 'Asked 08:50'],
  ['Nguyen Thi Hoa', 'team', 'VIE', 'waiting', 'Coach', 'Asked 07:22'], ['Agus Wijaya', 'team', 'INA', 'waiting', 'Wheelchair technician', 'Asked 06:05'],
  ['Suda Charoenphon', 'admin', '', 'active', 'Competition manager', 'Now'], ['Kanya Wongsakul', 'team', 'THA', 'active', 'Team manager', '2 min ago'],
  ['Niran Suksawat', 'sporter', 'THA', 'active', 'Athlete · T54', '5 min ago'], ['Arif Rahman', 'judge', '', 'active', 'Chief judge, throws', 'Now'],
  ['Hannah Lindqvist', 'judge', '', 'active', 'Track referee', 'Now'], ['Bounmy Keo', 'team', 'CAM', 'locked', 'Coach', 'Yesterday'],
].map(([name, role, country, status, job, seen], i) => ({ id: i + 1, name, role, country, status, job, seen }))
export const getUsers = () => store('users', USERS)
export const saveUsers = (list) => save('users', list)

export const getSettings = () => store('settings', { protest: '30', unofficial: 'label', thai: true, autoMedals: true })
export const saveSettings = (s) => save('settings', s)
