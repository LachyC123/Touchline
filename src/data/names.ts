/**
 * Curated, compositional name pools. Setting rule (v1): TOUCHLINE! is a fictional men's
 * seven-a-side pyramid in a British-flavoured football culture with players of many heritages.
 * Names are combined within a pool, never across pools, so pronunciation stays plausible.
 * All combinations are fictional; any resemblance to a real person is coincidental.
 */

export interface NamePool {
  id: string;
  nationality: string;
  weight: number;
  given: readonly string[];
  family: readonly string[];
  towns: readonly string[];
}

export const NAME_POOLS: readonly NamePool[] = [
  {
    id: 'eng',
    nationality: 'English',
    weight: 30,
    given: [
      'Jack', 'Harry', 'Callum', 'Tom', 'Ollie', 'Alfie', 'Dan', 'Reece', 'Kieran', 'Lewis', 'Josh', 'Ben', 'Sam', 'Luke',
      'Charlie', 'George', 'Archie', 'Mason', 'Tyler', 'Jordan', 'Kai', 'Jamie', 'Ryan', 'Connor', 'Liam', 'Nathan', 'Elliot',
      'Theo', 'Freddie', 'Billy', 'Joe', 'Danny', 'Rhys', 'Toby', 'Max', 'Finley', 'Zak', 'Aaron', 'Marcus', 'Jake', 'Arjun',
      'Ravi', 'Imran', 'Zayn', 'Adam', 'Hassan', 'Dev', 'Tariq',
    ],
    family: [
      'Hargreaves', 'Ashworth', 'Bramley', 'Calloway', 'Dobson', 'Fenwick', 'Garside', 'Holloway', 'Kettering', 'Lindley',
      'Marsh', 'Northcott', 'Pickering', 'Radley', 'Shawcross', 'Thorne', 'Underwood', 'Whitlock', 'Yardley', 'Ackroyd',
      'Barnsdale', 'Cotterill', 'Dunmore', 'Ellwood', 'Fairhurst', 'Goodall', 'Hebden', 'Ingham', 'Jessop', 'Kershaw',
      'Lister', 'Midgley', 'Netherton', 'Oakes', 'Pemberton', 'Royle', 'Sutcliffe', 'Tattersall', 'Vickers', 'Wainwright',
      'Bassi', 'Chaudhry', 'Mistry', 'Rahman', 'Sandhu', 'Malik', 'Patel', 'Hussain',
    ],
    towns: ['Copperton', 'Stagmoor', 'Ashgate', 'Millbrook', 'Ironbridge', 'Cinderfield', 'Larkwell', 'Fallowby', 'Redhithe', 'Gullstone'],
  },
  {
    id: 'sco',
    nationality: 'Scottish',
    weight: 7,
    given: ['Euan', 'Fraser', 'Callum', 'Ross', 'Craig', 'Hamish', 'Angus', 'Lachlan', 'Alasdair', 'Ewan', 'Murray', 'Gregor', 'Blair', 'Calum', 'Jamie', 'Rory'],
    family: ['McAllister', 'Drummond', 'Baird', 'Lennox', 'Cairns', 'Galbraith', 'Munro', 'Ritchie', 'Sinclair', 'Strachan', 'Urquhart', 'Kerr', 'Laidlaw', 'Moffat', 'Rennie', 'Tennant'],
    towns: ['Kilbrae', 'Glenmorrow', 'Dunlachan', 'Port Ailsa', 'Craigmuir'],
  },
  {
    id: 'wal',
    nationality: 'Welsh',
    weight: 5,
    given: ['Rhys', 'Dafydd', 'Owain', 'Gethin', 'Iwan', 'Gareth', 'Emyr', 'Steffan', 'Tomos', 'Cai', 'Morgan', 'Huw', 'Aled', 'Bryn', 'Ioan', 'Elis'],
    family: ['Pritchard', 'Llewellyn', 'Bevan', 'Prosser', 'Gwilym', 'Vaughan', 'Powell', 'Parry', 'Meredith', 'Rees', 'Howells', 'Price', 'Griffiths', 'Morgan-Lloyd', 'Pugh', 'Lewis'],
    towns: ['Aberllyn', 'Pontwen', 'Caerfelin', 'Llanhaf'],
  },
  {
    id: 'irl',
    nationality: 'Irish',
    weight: 6,
    given: ['Cian', 'Darragh', 'Eoin', 'Conor', 'Seán', 'Ronan', 'Fionn', 'Oisín', 'Cathal', 'Niall', 'Declan', 'Shane', 'Tadhg', 'Ciarán'],
    family: ['Brennan', 'Doyle', 'Fitzgerald', 'Gallagher', 'Kavanagh', 'McGrath', 'Nolan', 'Quinlan', 'Rooney', 'Sheridan', 'Tierney', 'Whelan', 'Carragh', 'Duggan'],
    towns: ['Ballinmore', 'Kilcarra', 'Rossbeg', 'Dunmanway Cross'],
  },
  {
    id: 'nga',
    nationality: 'Nigerian',
    weight: 6,
    given: ['Chidi', 'Tunde', 'Emeka', 'Femi', 'Kelechi', 'Obinna', 'Segun', 'Ikenna', 'Dayo', 'Uche', 'Tobi', 'Jide', 'Chinedu', 'Kunle', 'Ayo', 'Nnamdi', 'Ebuka', 'Gbenga'],
    family: ['Okoro', 'Adeyemi', 'Nwosu', 'Balogun', 'Eze', 'Okafor', 'Adebayo', 'Obi', 'Ogunleye', 'Chukwu', 'Afolabi', 'Ojo', 'Uzoma', 'Iwobi', 'Oyelaran', 'Bankole', 'Onyeka', 'Akinola'],
    towns: ['Ibadan', 'Enugu', 'Abeokuta', 'Port Harcourt'],
  },
  {
    id: 'gha',
    nationality: 'Ghanaian',
    weight: 4,
    given: ['Kwame', 'Kofi', 'Yaw', 'Kwabena', 'Kojo', 'Kwesi', 'Nana', 'Fiifi', 'Ekow', 'Kweku', 'Kwaku', 'Akwasi', 'Edem', 'Selorm', 'Kobina', 'Elikem'],
    family: ['Mensah', 'Owusu', 'Asante', 'Boateng', 'Appiah', 'Darko', 'Ofori', 'Amponsah', 'Agyeman', 'Badu', 'Addo', 'Quaye', 'Tetteh', 'Ansah', 'Acheampong', 'Frimpong'],
    towns: ['Kumasi', 'Cape Coast', 'Tamale', 'Takoradi'],
  },
  {
    id: 'jam',
    nationality: 'Jamaican',
    weight: 4,
    given: ['Andre', 'Dwayne', 'Delroy', 'Jermaine', 'Tyrone', 'Romario', 'Kemar', 'Shamar', 'Odane', 'Rushane', 'Damion', 'Leon', 'Javon', 'Kirk', 'Omar', 'Rohan'],
    family: ['Campbell', 'Brown', 'Grant', 'McKenzie', 'Reid', 'Thompson', 'Gayle', 'Morrison', 'Bailey', 'Whyte', 'Francis', 'Lawrence', 'Chambers', 'Spence', 'Dacres', 'Bennett'],
    towns: ['Kingston', 'Montego Bay', 'Spanish Town', 'Mandeville'],
  },
  {
    id: 'pol',
    nationality: 'Polish',
    weight: 4,
    given: ['Kacper', 'Szymon', 'Jakub', 'Mateusz', 'Bartosz', 'Kamil', 'Wojciech', 'Tomasz', 'Piotr', 'Michał', 'Filip', 'Dawid', 'Oskar', 'Patryk', 'Łukasz', 'Igor'],
    family: ['Nowicki', 'Zieliński', 'Kowalczyk', 'Wróbel', 'Dudek', 'Sikora', 'Pawlak', 'Baran', 'Górski', 'Mazur', 'Kaczmarek', 'Wieczorek', 'Jabłoński', 'Krawczyk', 'Michalak', 'Sobczak'],
    towns: ['Łódź', 'Poznań', 'Gdynia', 'Lublin'],
  },
  {
    id: 'por',
    nationality: 'Portuguese',
    weight: 4,
    given: ['Tiago', 'Duarte', 'Rui', 'Gonçalo', 'Nuno', 'Afonso', 'Diogo', 'Rafael', 'Vasco', 'Bruno', 'Martim', 'Rodrigo', 'Simão', 'Henrique', 'Leandro', 'Fábio'],
    family: ['Serrano', 'Tavares', 'Moreira', 'Calado', 'Fontes', 'Lourenço', 'Pinheiro', 'Quaresma', 'Rebelo', 'Valente', 'Brandão', 'Couto', 'Esteves', 'Magalhães', 'Sequeira', 'Torres'],
    towns: ['Braga', 'Setúbal', 'Faro', 'Aveiro'],
  },
  {
    id: 'esp',
    nationality: 'Spanish',
    weight: 4,
    given: ['Milo', 'Dario', 'Álvaro', 'Iker', 'Javi', 'Marcos', 'Unai', 'Hugo', 'Pablo', 'Sergio', 'Adrián', 'Rubén', 'Gonzalo', 'Íñigo', 'Mario', 'Raúl'],
    family: ['Serrano', 'Alcaraz', 'Benítez', 'Castillo', 'Delgado', 'Escobar', 'Gallardo', 'Herrera', 'Ibarra', 'Navarro', 'Ortega', 'Prieto', 'Robles', 'Salinas', 'Vidal', 'Montero'],
    towns: ['Cádiz', 'Vigo', 'Zaragoza', 'Murcia'],
  },
  {
    id: 'fra',
    nationality: 'French',
    weight: 4,
    given: ['Théo', 'Lucas', 'Mathis', 'Enzo', 'Nolan', 'Yanis', 'Maxime', 'Hugo', 'Bastien', 'Rayan', 'Clément', 'Romain', 'Kylian', 'Adrien', 'Florian', 'Malik'],
    family: ['Lefèvre', 'Garnier', 'Rousseau', 'Mercier', 'Fournier', 'Chevalier', 'Bonnet', 'Lambert', 'Girard', 'Morel', 'Faure', 'Gauthier', 'Perrin', 'Roussel', 'Masson', 'Blanchard'],
    towns: ['Lille', 'Nantes', 'Rennes', 'Le Havre'],
  },
  {
    id: 'ned',
    nationality: 'Dutch',
    weight: 3,
    given: ['Daan', 'Sem', 'Bram', 'Jens', 'Thijs', 'Ruben', 'Stijn', 'Joris', 'Niels', 'Teun', 'Luuk', 'Milan', 'Jesse', 'Wout', 'Gijs', 'Koen'],
    family: ['de Vries', 'Bakker', 'Visser', 'Smit', 'Mulder', 'van Dijkhuis', 'Hoekstra', 'Brouwer', 'Kuiper', 'Postma', 'Dijkstra', 'Veenstra', 'Bosman', 'Hendriks', 'Kramer', 'van Loon'],
    towns: ['Utrecht', 'Zwolle', 'Groningen', 'Breda'],
  },
  {
    id: 'sen',
    nationality: 'Senegalese',
    weight: 3,
    given: ['Moussa', 'Ibrahima', 'Cheikh', 'Pape', 'Mamadou', 'Ousmane', 'Lamine', 'Abdou', 'Babacar', 'Idrissa', 'Aliou', 'Modou', 'Saliou', 'Assane', 'Malick', 'Bamba'],
    family: ['Diallo', 'Ndiaye', 'Sarr', 'Faye', 'Gueye', 'Diouf', 'Cissé', 'Sow', 'Mbaye', 'Seck', 'Diagne', 'Thiam', 'Ndour', 'Kouyaté', 'Badji', 'Mané'],
    towns: ['Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor'],
  },
  {
    id: 'bra',
    nationality: 'Brazilian',
    weight: 3,
    given: ['Thiago', 'Matheus', 'Caio', 'Renan', 'Vinícius', 'Igor', 'Davi', 'Luan', 'Henrique', 'Wesley', 'Gabriel', 'Felipe', 'Murilo', 'Otávio', 'Diego', 'Everton'],
    family: ['Souza', 'Ferreira', 'Barbosa', 'Rocha', 'Carvalho', 'Moura', 'Teixeira', 'Pinto', 'Araújo', 'Cardoso', 'Nascimento', 'Ribeiro', 'Gomes', 'Correia', 'Lopes', 'Monteiro'],
    towns: ['Recife', 'Curitiba', 'Belém', 'Santos'],
  },
  {
    id: 'tur',
    nationality: 'Turkish',
    weight: 3,
    given: ['Emre', 'Kerem', 'Burak', 'Arda', 'Mert', 'Cem', 'Onur', 'Yusuf', 'Barış', 'Kaan', 'Efe', 'Oğuz', 'Serkan', 'Tolga', 'Umut', 'Volkan'],
    family: ['Yıldız', 'Aydın', 'Kaya', 'Şahin', 'Demir', 'Çelik', 'Arslan', 'Doğan', 'Kılıç', 'Öztürk', 'Aksoy', 'Erdem', 'Koç', 'Polat', 'Tekin', 'Yavuz'],
    towns: ['İzmir', 'Bursa', 'Trabzon', 'Antalya'],
  },
  {
    id: 'jpn',
    nationality: 'Japanese',
    weight: 2,
    given: ['Haruto', 'Ren', 'Sota', 'Yuto', 'Kaito', 'Riku', 'Daiki', 'Takumi', 'Kenta', 'Shun', 'Hiroki', 'Yuki', 'Koki', 'Taiga', 'Ryota', 'Sho'],
    family: ['Tanaka', 'Nakamura', 'Kobayashi', 'Matsuda', 'Inoue', 'Kimura', 'Hayashi', 'Shimizu', 'Mori', 'Ishikawa', 'Fujita', 'Okada', 'Ueda', 'Endo', 'Aoki', 'Nishimura'],
    towns: ['Sendai', 'Kobe', 'Niigata', 'Kumamoto'],
  },
];

/**
 * Substrings that must never appear in a generated display name (case-insensitive).
 * Pools are curated, so this is a defence-in-depth check verified by the 10k test.
 */
export const FORBIDDEN_NAME_FRAGMENTS: readonly string[] = [
  'nazi', 'hitler', 'rape', 'slut', 'whore', 'cunt', 'fuck', 'shit', 'nigg', 'fag', 'retard', 'paki', 'spic', 'kike', 'chink', 'coon',
];

export function isNameAllowed(display: string): boolean {
  const flat = display.toLowerCase().replace(/[^a-z]/g, '');
  return !FORBIDDEN_NAME_FRAGMENTS.some((f) => flat.includes(f));
}
