export interface UniversityOption {
  name: string;
  abbreviation: string;
  location: string;
}

export const UNIVERSITY_OPTIONS: UniversityOption[] = [
  { name: 'University of Dar es Salaam', abbreviation: 'UDSM', location: 'Dar es Salaam, Tanzania' },
  { name: 'University of Dodoma', abbreviation: 'UDOM', location: 'Dodoma, Tanzania' },
  { name: 'State University of Zanzibar', abbreviation: 'SUZA', location: 'Zanzibar' },
  { name: 'Sokoine University of Agriculture', abbreviation: 'SUA', location: 'Morogoro, Tanzania' },
  { name: 'Muhimbili University of Health and Allied Sciences', abbreviation: 'MUHAS', location: 'Dar es Salaam, Tanzania' },
  { name: 'Mzumbe University', abbreviation: 'MU', location: 'Morogoro, Tanzania' },
  { name: 'Ardhi University', abbreviation: 'ARU', location: 'Dar es Salaam, Tanzania' },
  { name: 'Open University of Tanzania', abbreviation: 'OUT', location: 'Dar es Salaam, Tanzania' },
  { name: 'Mbeya University of Science and Technology', abbreviation: 'MUST', location: 'Mbeya, Tanzania' },
  { name: 'Moshi Co-operative University', abbreviation: 'MoCU', location: 'Moshi, Kilimanjaro, Tanzania' },
  { name: 'Nelson Mandela African Institution of Science and Technology', abbreviation: 'NM-AIST', location: 'Arusha, Tanzania' },
  { name: 'Institute of Accountancy Arusha', abbreviation: 'IAA', location: 'Arusha, Tanzania' },
  { name: 'St. Augustine University of Tanzania', abbreviation: 'SAUT', location: 'Mwanza, Tanzania' },
  { name: "St. John's University of Tanzania", abbreviation: 'SJUT', location: 'Dodoma, Tanzania' },
  { name: 'University of Iringa', abbreviation: 'UoI', location: 'Iringa, Tanzania' },
  { name: 'Zanzibar University', abbreviation: 'ZU', location: 'Zanzibar' },
  { name: 'Abdulrahman Al-Sumait University', abbreviation: 'SUMAIT', location: 'Zanzibar' },
  { name: 'Tumaini University Makumira', abbreviation: 'TUMA', location: 'Arusha, Tanzania' },
  { name: 'Ruaha Catholic University', abbreviation: 'RUCU', location: 'Iringa, Tanzania' },
  { name: 'Hubert Kairuki Memorial University (Kairuki University)', abbreviation: 'KU', location: 'Dar es Salaam, Tanzania' },
  { name: 'Catholic University of Health and Allied Sciences', abbreviation: 'CUHAS', location: 'Mwanza, Tanzania' },
  { name: 'University of Arusha', abbreviation: 'UoA', location: 'Arusha, Tanzania' },
  { name: 'Mwenge Catholic University', abbreviation: 'MWECAU', location: 'Moshi, Kilimanjaro, Tanzania' },
  { name: 'Mwalimu Julius K. Nyerere University of Agriculture and Technology', abbreviation: 'MJNUAT', location: 'Butiama, Mara, Tanzania' },
  { name: 'St. Joseph University in Tanzania', abbreviation: 'SJUIT', location: 'Dar es Salaam, Tanzania' },
  { name: 'Other', abbreviation: 'Other', location: 'Not listed above' },
];

export const UNIVERSITIES = UNIVERSITY_OPTIONS.map((u) => u.name);
