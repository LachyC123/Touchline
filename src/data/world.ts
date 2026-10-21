import type { AiStyle } from '../game/simulation/types';

/**
 * Building blocks for a career's world: towns, their trades, grounds, club names and the small
 * oddities that make a club memorable. Towns are compounds of a fictional prefix and suffix;
 * combinations that spell a well-known real town are skipped. Any other resemblance is unintended.
 */

export const TOWN_PREFIXES = [
  'Ash', 'Alder', 'Barrow', 'Bram', 'Brindle', 'Cald', 'Carrow', 'Chalk', 'Cinder', 'Copper', 'Crane', 'Crow', 'Dun', 'Elder',
  'Fallow', 'Fen', 'Flint', 'Gull', 'Gorse', 'Grimble', 'Hallow', 'Harrow', 'Hazel', 'Heron', 'Holly', 'Iron', 'Kestrel', 'Kiln',
  'Lark', 'Linden', 'Marl', 'Mallow', 'Mere', 'Mill', 'Nettle', 'Oaken', 'Otter', 'Pebble', 'Pike', 'Quarry', 'Raven', 'Red',
  'Reed', 'Rook', 'Rowan', 'Saltern', 'Sedge', 'Shale', 'Sorrel', 'Stag', 'Starling', 'Stoat', 'Tallow', 'Teasel', 'Thistle',
  'Tinker', 'Umber', 'Wether', 'Whin', 'Willow', 'Wren', 'Yarrow',
] as const;

export const TOWN_SUFFIXES = [
  'bury', 'by', 'combe', 'dale', 'den', 'field', 'ford', 'gate', 'ham', 'hithe', 'holme', 'ley', 'mere', 'moor', 'mouth',
  'ridge', 'stead', 'stow', 'thorpe', 'ton', 'wick', 'well', 'worth', 'brook', 'bridge', 'cross', 'haven', 'lowe',
] as const;

/** Real places (several with well-known clubs) a compound could otherwise spell. */
export const REAL_TOWNS = new Set([
  'Ashford', 'Ashby', 'Ashton', 'Ashley', 'Ashbury', 'Bramley', 'Bramhall', 'Barrowby', 'Barrowford', 'Crowborough', 'Dunstable', 'Dunbridge',
  'Fenton', 'Ironbridge', 'Millbrook', 'Milton', 'Redditch', 'Redbridge', 'Redhill', 'Redcar', 'Reedham', 'Ravensworth', 'Rowley',
  'Stagsden', 'Whinfield', 'Willowfield', 'Hazelwood', 'Copperton', 'Cinderford', 'Hollybush', 'Ashwell', 'Ashwick', 'Crowthorpe',
  'Linton', 'Marlow', 'Mereworth', 'Oakenholme', 'Pikeley', 'Redmoor', 'Redcross', 'Ashgate', 'Flintham', 'Hallowell', 'Harrowgate',
  'Kilnsey', 'Larkfield', 'Wrenbury', 'Elderfield', 'Gorseley', 'Fenstead', 'Chalkwell', 'Dunford', 'Dunham', 'Dunley', 'Dunton',
  'Ashcombe', 'Crowton', 'Ravenstone', 'Rookwood', 'Starlington', 'Reedley', 'Stagbury',
]);

export const INDUSTRIES = [
  {
    id: 'mill',
    label: 'mill town',
    grounds: ['The Mill', 'Weavers Lane', 'Loom Street', 'Bobbin Park', 'The Spindle'],
    lines: ['A mill town that still keeps time by the factory hooter.', 'Built on cotton and stubbornness.'],
    nick: 'Weavers',
  },
  {
    id: 'port',
    label: 'harbour town',
    grounds: ['Dockside', 'The Quay', 'Harbour Road', 'Anchor Park', 'The Slipway'],
    lines: ['A harbour town: the wind off the sea is worth a goal a game.', 'Fishermen in the stand, salt on everything.'],
    nick: 'Mariners',
  },
  {
    id: 'quarry',
    label: 'quarry town',
    grounds: ['The Quarry', 'Slate Lane', 'Granite Park', 'The Pit', 'Blastface Road'],
    lines: ['Quarry-hard. The pitch is mostly gravel by March.', 'They cut stone for a living and kick like it.'],
    nick: 'Quarrymen',
  },
  {
    id: 'railway',
    label: 'railway town',
    grounds: ['The Sidings', 'Station Road', 'Signal Box Lane', 'The Depot', 'Platform Park'],
    lines: ['A railway town: the 3:15 goes past the ground every match.', 'Founded by engine drivers in 1891.'],
    nick: 'Railwaymen',
  },
  {
    id: 'market',
    label: 'market town',
    grounds: ['Market Lane', 'The Shambles', 'Cattle Market', 'Corn Exchange Park', 'Butter Cross'],
    lines: ['A market town that closes the stalls early on match days.', 'Proud, old-fashioned and very loud.'],
    nick: 'Traders',
  },
  {
    id: 'seaside',
    label: 'seaside town',
    grounds: ['The Pier', 'Promenade Park', 'Gull Lane', 'The Esplanade', 'Bandstand Road'],
    lines: ['A seaside town. The gulls take more pies than the fans.', 'Holidaymakers in summer, diehards in winter.'],
    nick: 'Seasiders',
  },
  {
    id: 'brewery',
    label: 'brewery town',
    grounds: ['The Brewery', 'Hops Lane', 'Malt Street', 'Barley Park', 'The Mash Tun'],
    lines: ['The brewery sponsors the shirts, the bar and most of the team.', 'You can smell the hops from the halfway line.'],
    nick: 'Brewers',
  },
  {
    id: 'pottery',
    label: 'pottery town',
    grounds: ['The Kiln', 'Clay Lane', 'Glaze Road', 'The Potbank', 'Saggar Park'],
    lines: ['Pottery town, bottle kilns on the skyline behind the goal.', 'Every fan has a mug with the crest on it.'],
    nick: 'Kilnsmen',
  },
  {
    id: 'mining',
    label: 'pit village',
    grounds: ['The Pithead', 'Colliery Lane', 'Coalyard Park', 'The Winding Wheel', 'Lamp Room Road'],
    lines: ['A pit village. The pit closed; the club did not.', 'Hard men, hard pitch, harder tea.'],
    nick: 'Colliers',
  },
  {
    id: 'farming',
    label: 'farming village',
    grounds: ['The Meadow', 'Haybarn Lane', 'Plough Park', 'Shepherds Field', 'The Rickyard'],
    lines: ['A farming village with a pitch borrowed from the cows.', 'Kick-offs move around the harvest.'],
    nick: 'Ploughboys',
  },
  {
    id: 'canal',
    label: 'canal town',
    grounds: ['The Towpath', 'Lock Lane', 'Wharf Road', 'The Basin', 'Narrowboat Park'],
    lines: ['A canal town. Balls over the stand end up three locks away.', 'Slow water, quick wingers.'],
    nick: 'Bargemen',
  },
  {
    id: 'steel',
    label: 'steel town',
    grounds: ['The Furnace', 'Forge Lane', 'Ingot Park', 'Smelter Road', 'The Rolling Mill'],
    lines: ['A steel town with sparks in its blood.', 'Forged, not made. They say it on the gates.'],
    nick: 'Forgemen',
  },
] as const;

export type IndustryId = (typeof INDUSTRIES)[number]['id'];

export const GROUND_PATTERNS = ['{t} Road', '{t} Lane', '{t} Park', '{t} Common', 'The {t} Ground'] as const;

/** Club name endings, weighted. "{t}" is the town. */
export const CLUB_NAME_PATTERNS: readonly (readonly [string, number])[] = [
  ['{t} Town', 22],
  ['{t} United', 12],
  ['{t} FC', 12],
  ['{t} Athletic', 10],
  ['{t} Rovers', 8],
  ['{t} Wanderers', 6],
  ['{t} Albion', 5],
  ['{t} Rangers', 5],
  ['{t} Borough', 5],
  ['{t} Harriers', 3],
  ['{t} Sporting', 2],
  ['{t} Corinthians', 2],
  ['AFC {t}', 3],
  ['{t} Victoria', 2],
];

export const STYLE_LINES: Readonly<Record<AiStyle, readonly string[]>> = {
  balanced: ['Organised and patient. Nothing fancy, nothing missing.', 'A tidy side that does the simple things well.', 'Hard to beat, hard to love.'],
  press: ['They hunt in packs and never stop running.', 'Relentless pressers: expect no time on the ball.', 'Young legs, high line, no fear.'],
  passing: ['Pass, pass, pass. They will keep the ball all day.', 'Neat triangles and a keeper who wants to be a midfielder.', 'Easy on the eye, soft in the tackle.'],
  counter: ['They sit deep and wait for your mistake.', 'Defend in numbers and break at pace.', 'Happy without the ball. Dangerous when they get it.'],
  direct: ['Go long, win the second ball, repeat.', 'Big men up top and a keeper who can kick to the other box.', 'Physical, direct, and proud of it.'],
};

/** One memorable oddity per club. */
export const CLUB_QUIRKS = [
  'Their keeper is 41 and still shouts at everyone.',
  'Famous for the pies; infamous for the pitch.',
  'The whole town turns out, and the whole town shouts.',
  'Never won anything, never stopped believing.',
  'A rich new owner and very impatient fans.',
  'The pitch slopes noticeably towards the river end.',
  'They have the same three brothers in midfield since 2015.',
  'The club cat has its own seat in the dugout.',
  'Their manager wears a flat cap in every weather.',
  'A drummer in the stand who never, ever stops.',
  'They still use the old wooden stand from 1923.',
  'Every home game starts with the same brass band song.',
  'Their striker is also the town postman.',
  'Rumour says the groundsman waters one half only.',
  'The changing rooms are in a converted bus.',
  'Their chairman also runs the tea hut, badly.',
  'Unbeaten on Boxing Day for eleven years.',
  'A floodlight that only works on one side.',
  'Their fans sing every name in the team, in order.',
  'They lost a cup final on a coin toss in 1978 and never forgot.',
] as const;

/** Curated kit colour pairs (contrast with the pitch and with each other). */
export const KIT_PAIRS: readonly (readonly [string, string])[] = [
  ['#F2A33A', '#1B2235'], ['#B5532A', '#FFF7E9'], ['#8A3324', '#E8D9A8'], ['#2E6FBF', '#FFF7E9'], ['#1E7B5A', '#F4C653'],
  ['#5B3BB5', '#FFF7E9'], ['#22252B', '#F2A33A'], ['#C8302B', '#1B2235'], ['#E6C229', '#1B2235'], ['#1D3557', '#F4F1EA'],
  ['#7A1F3D', '#8FD0F2'], ['#3A7D44', '#FFF7E9'], ['#D96C9A', '#1B2235'], ['#6EC3F0', '#1F3566'], ['#F4F1EA', '#C8302B'],
  ['#4A4E69', '#F2E9E4'], ['#A3542C', '#2B2D42'], ['#0F7173', '#F0C808'], ['#9C2C77', '#F5D547'], ['#2B2D42', '#8D99AE'],
  ['#E07A5F', '#3D405B'], ['#264653', '#E9C46A'], ['#F4F1EA', '#2E6FBF'], ['#BC4749', '#F2E8CF'],
];

/** "Supporters" nicknames from animals and birds, used when the trade does not fit. */
export const NICKNAMES = ['Magpies', 'Robins', 'Foxes', 'Badgers', 'Hares', 'Owls', 'Kestrels', 'Otters', 'Stags', 'Swifts', 'Rooks', 'Herons'] as const;
