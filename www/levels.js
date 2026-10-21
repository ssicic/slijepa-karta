// Quiz content. Points are [name, lat, lon, optional info shown after answering].
// Rivers come from MAP_DATA.rivers, island outlines from MAP_DATA.areas (both from OpenStreetMap).
// perRound: how many questions the main game asks per level (random pick). Practice asks all of them.
// fullKm: guesses closer than this get 100 points. zeroKm: guesses this far or more get 0.
window.LEVELS = [
  {
    id: 'big-cities', title: 'Veliki gradovi', perRound: 5, fullKm: 5, zeroKm: 80,
    items: [
      ['Zagreb', 45.815, 15.982], ['Split', 43.508, 16.440], ['Rijeka', 45.327, 14.442],
      ['Osijek', 45.555, 18.695], ['Zadar', 44.119, 15.231], ['Pula', 44.867, 13.850],
      ['Slavonski Brod', 45.160, 18.016], ['Karlovac', 45.487, 15.548], ['Varaždin', 46.304, 16.338],
      ['Šibenik', 43.735, 15.889], ['Dubrovnik', 42.650, 18.094], ['Sisak', 45.466, 16.378],
    ],
  },
  {
    id: 'small-cities', title: 'Manji gradovi', perRound: 5, fullKm: 5, zeroKm: 70,
    items: [
      ['Vukovar', 45.351, 19.002], ['Bjelovar', 45.899, 16.843], ['Koprivnica', 46.162, 16.828],
      ['Čakovec', 46.384, 16.434], ['Požega', 45.340, 17.685], ['Vinkovci', 45.288, 18.805],
      ['Gospić', 44.546, 15.375], ['Virovitica', 45.832, 17.384], ['Makarska', 43.297, 17.017],
      ['Poreč', 45.227, 13.595], ['Rovinj', 45.081, 13.639], ['Krapina', 46.161, 15.879],
      ['Knin', 44.041, 16.199], ['Senj', 44.989, 14.906], ['Đakovo', 45.308, 18.411],
      ['Nova Gradiška', 45.255, 17.383], ['Metković', 43.054, 17.648], ['Opatija', 45.338, 14.305],
      ['Trogir', 43.516, 16.251], ['Samobor', 45.803, 15.711], ['Velika Gorica', 45.712, 16.076],
      ['Kutina', 45.475, 16.782], ['Pazin', 45.240, 13.937], ['Ogulin', 45.266, 15.229],
      ['Imotski', 43.447, 17.216], ['Sinj', 43.703, 16.639],
    ],
  },
  {
    id: 'rivers', title: 'Rijeke', perRound: 5, fullKm: 3, zeroKm: 50,
    rivers: ['Sava', 'Drava', 'Dunav', 'Kupa', 'Una', 'Mura', 'Neretva',
      'Krka', 'Cetina', 'Korana', 'Mrežnica', 'Dobra', 'Zrmanja', 'Lika', 'Gacka',
      'Bosut', 'Vuka', 'Mirna', 'Raša', 'Rječina', 'Glina', 'Lonja', 'Bednja', 'Česma',
      'Ilova', 'Orljava', 'Karašica', 'Odra'],
  },
  {
    id: 'mountains', title: 'Planine', perRound: 5, fullKm: 8, zeroKm: 70,
    items: [
      ['Dinara', 44.063, 16.388], ['Velebit', 44.358, 15.520], ['Biokovo', 43.342, 17.054],
      ['Učka', 45.285, 14.200], ['Risnjak', 45.427, 14.618], ['Medvednica', 45.900, 15.945],
      ['Mosor', 43.531, 16.626], ['Papuk', 45.524, 17.656], ['Psunj', 45.388, 17.330],
      ['Žumberačka gora', 45.788, 15.317], ['Kalnik', 46.130, 16.460], ['Ivanščica', 46.183, 16.135],
      ['Bjelolasica', 45.272, 14.976], ['Svilaja', 43.812, 16.459],
    ],
  },
  {
    id: 'national-parks', title: 'Nacionalni parkovi', perRound: 5, fullKm: 8, zeroKm: 70,
    items: [
      ['Plitvička jezera', 44.880, 15.616], ['Krka', 43.805, 15.966], ['Kornati', 43.810, 15.290],
      ['Mljet', 42.775, 17.370], ['Brijuni', 44.913, 13.765], ['Paklenica', 44.360, 15.470],
      ['Risnjak', 45.430, 14.630], ['Sjeverni Velebit', 44.760, 15.020],
    ],
  },
  {
    // Tapping anywhere on the island counts as a hit.
    id: 'islands', title: 'Otoci', perRound: 5, fullKm: 1, zeroKm: 40,
    areas: ['Krk', 'Cres', 'Brač', 'Hvar', 'Pag', 'Korčula', 'Dugi otok', 'Mljet', 'Rab', 'Vis',
      'Lošinj', 'Šolta', 'Pašman', 'Ugljan', 'Lastovo', 'Čiovo', 'Murter', 'Silba', 'Žirje', 'Iž',
      'Molat', 'Susak', 'Unije', 'Olib', 'Kornat', 'Biševo', 'Šipan', 'Lopud', 'Zlarin'],
  },
  {
    // Coordinates and power from OpenStreetMap (power=plant).
    id: 'power-plants', title: 'Elektrane', perRound: 5, fullKm: 5, zeroKm: 60,
    items: [
      ['HE Zakučac', 43.4596, 16.7052, 'hidroelektrana na Cetini, 538 MW, najveća u Hrvatskoj'],
      ['HE Orlovac', 43.6731, 16.7835, 'hidroelektrana, 237 MW'],
      ['RHE Velebit', 44.2078, 15.7541, 'reverzibilna hidroelektrana, 276 MW'],
      ['HE Senj', 44.9419, 14.9329, 'hidroelektrana, 216 MW'],
      ['HE Dubrovnik', 42.6543, 18.3056, 'hidroelektrana u Platu, 117,5 MW'],
      ['HE Varaždin', 46.3481, 16.2685, 'hidroelektrana na Dravi, 94 MW'],
      ['HE Peruća', 43.7951, 16.5965, 'hidroelektrana na Cetini, 61,4 MW'],
      ['HE Jaruga', 43.8049, 15.9625, 'hidroelektrana na Krki, puštena u rad 1895.'],
      ['TE Plomin', 45.1361, 14.1654, 'termoelektrana na ugljen, 199 MW'],
      ['TE-TO Zagreb', 45.7813, 16.0164, 'termoelektrana-toplana, 300 MW'],
      ['TE-TO Sisak', 45.4540, 16.4139, 'termoelektrana-toplana, 229 MW'],
      ['TE-TO Osijek', 45.5425, 18.7449, 'termoelektrana-toplana, 89 MW'],
    ],
  },
];
