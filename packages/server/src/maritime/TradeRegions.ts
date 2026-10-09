import type { CanonicalPortRecord } from '../data/portCatalog.js';

export interface TradeRegionDefinition {
  id: string;
  name: string;
  description: string;
  basis: string;
}

export const TRADE_REGIONS: TradeRegionDefinition[] = [
  { id: 'north-america', name: 'North America & Caribbean', description: 'North American, Central American and Caribbean port markets.', basis: 'Port country grouping; regional model boundary, not an official customs union.' },
  { id: 'south-america', name: 'South America', description: 'South American port markets.', basis: 'Port country grouping; regional model boundary, not an official customs union.' },
  { id: 'europe', name: 'Europe & Mediterranean', description: 'European and Mediterranean port markets.', basis: 'Port country grouping; Russia is split at 60°E for this model.' },
  { id: 'africa', name: 'Africa', description: 'African port markets.', basis: 'Port country grouping; Egypt is grouped with the Middle East for this model.' },
  { id: 'middle-east', name: 'Middle East & Gulf', description: 'Middle Eastern and Gulf port markets.', basis: 'Port country grouping; model region only.' },
  { id: 'south-asia', name: 'South Asia', description: 'South Asian and Indian Ocean port markets.', basis: 'Port country grouping; model region only.' },
  { id: 'east-southeast-asia', name: 'East & Southeast Asia', description: 'East Asian and Southeast Asian port markets.', basis: 'Port country grouping; model region only.' },
  { id: 'oceania', name: 'Oceania & Pacific Islands', description: 'Australia, New Zealand and Pacific island port markets.', basis: 'Port country grouping; model region only.' },
  { id: 'polar', name: 'Antarctica', description: 'Antarctic port locations.', basis: 'Port country grouping.' },
  { id: 'unclassified', name: 'Other / unclassified', description: 'Ports whose catalog country has not yet been mapped to a planning region.', basis: 'Explicit fallback; review these countries before using them in regional analysis.' },
];

const countryGroups: Record<string, ReadonlySet<string>> = {
  'north-america': new Set([
    'United States', 'Canada', 'Mexico', 'Greenland', 'Bermuda', 'Belize', 'Costa Rica', 'El Salvador',
    'Guatemala', 'Honduras', 'Nicaragua', 'Panama', 'The Bahamas', 'Cuba', 'Dominican Republic', 'Haiti',
    'Jamaica', 'Puerto Rico', 'Trinidad and Tobago', 'Barbados', 'Aruba', 'Curacao', 'Caribbean Netherlands',
    'Cayman Islands', 'Turks and Caicos Islands', 'U.S. Virgin Islands', 'British Virgin Islands', 'Guadeloupe',
    'Martinique', 'Dominica', 'Grenada', 'Saint Lucia', 'Saint Kitts and Nevis',
    'Saint Vincent and the Grenadines (Windward Islands)', 'Saint Pierre and Miquelon', 'Sint Maarten', 'Antigua and Barbuda',
  ]),
  'south-america': new Set([
    'Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Ecuador', 'Falkland Islands (Islas Malvinas)',
    'French Guiana', 'Guyana', 'Paraguay', 'Peru', 'South Georgia and South Sandwich Islands', 'Suriname', 'Uruguay', 'Venezuela',
  ]),
  europe: new Set([
    'Albania', 'Andorra', 'Austria', 'Belarus', 'Belgium', 'Bosnia and Herzegovina', 'Bulgaria', 'Croatia',
    'Cyprus', 'Czechia', 'Denmark', 'Estonia', 'Faroe Islands', 'Finland', 'France', 'Germany', 'Gibraltar',
    'Georgia', 'Greece', 'Guernsey', 'Hungary', 'Iceland', 'Ireland', 'Isle of Man', 'Italy', 'Jersey', 'Latvia',
    'Lithuania', 'Luxembourg', 'Malta', 'Monaco', 'Montenegro', 'Netherlands', 'North Macedonia', 'Norway',
    'Poland', 'Portugal', 'Romania', 'Russia', 'San Marino', 'Serbia', 'Slovakia', 'Slovenia', 'Spain',
    'Svalbard', 'Sweden', 'Switzerland', 'Ukraine', 'United Kingdom', 'Vatican City',
  ]),
  africa: new Set([
    'Algeria', 'Angola', 'Benin', 'Botswana', 'British Indian Ocean Territory', 'Burkina Faso', 'Burundi',
    'Cabo Verde', 'Cameroon', 'Central African Republic', 'Chad', 'Comoros', 'Congo (Brazzaville)',
    'Congo (Kinshasa)', "Cote D'Ivoire", 'Djibouti', 'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Ethiopia',
    'Gabon', 'The Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Kenya', 'Lesotho', 'Liberia', 'Libya',
    'Madagascar', 'Malawi', 'Mauritania', 'Mauritius', 'Mayotte', 'Morocco', 'Mozambique', 'Namibia', 'Niger',
    'Nigeria', 'Reunion', 'Rwanda', 'Saint Helena, Ascension, and Tristan da Cunha', 'Sao Tome and Principe',
    'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia', 'South Africa', 'South Sudan', 'Sudan', 'Tanzania',
    'Togo', 'Tunisia', 'Uganda', 'Western Sahara', 'Zambia', 'Zimbabwe',
  ]),
  'middle-east': new Set([
    'Bahrain', 'Egypt', 'Iran', 'Iraq', 'Israel', 'Jordan', 'Kuwait', 'Lebanon', 'Oman', 'Palestine', 'Qatar',
    'Saudi Arabia', 'Syria', 'Turkey', 'United Arab Emirates', 'Yemen',
  ]),
  'south-asia': new Set([
    'Afghanistan', 'Bangladesh', 'Bhutan', 'India', 'Maldives', 'Nepal', 'Pakistan', 'Sri Lanka',
  ]),
  'east-southeast-asia': new Set([
    'Brunei', 'Burma', 'Cambodia', 'China', 'Hong Kong', 'Indonesia', 'Japan', 'Laos', 'Macau', 'Malaysia',
    'Mongolia', 'North Korea', 'Philippines', 'Singapore', 'South Korea', 'Taiwan', 'Thailand', 'Timor-Leste',
    'Vietnam',
  ]),
  oceania: new Set([
    'American Samoa', 'Australia', 'Christmas Island', 'Cocos (Keeling) Islands', 'Cook Islands', 'Fiji', 'French Polynesia',
    'Federated States of Micronesia', 'Guam', 'Johnson Atoll', 'Kiribati', 'Marshall Islands', 'Midway Islands', 'Nauru',
    'New Caledonia', 'New Zealand', 'Niue', 'Norfolk Island', 'Northern Mariana Islands', 'Palau', 'Papua New Guinea',
    'Pitcairn Islands', 'Samoa', 'Solomon Islands', 'Tokelau', 'Tonga', 'Tuvalu', 'Vanuatu', 'Wake Island',
    'Wallis and Futuna',
  ]),
  polar: new Set(['Antarctica']),
};

const regionById = new Map(TRADE_REGIONS.map(region => [region.id, region]));

export function getTradeRegionId(port: Pick<CanonicalPortRecord, 'country' | 'longitude'>): string {
  if (port.country === 'Russia') return port.longitude < 60 ? 'europe' : 'east-southeast-asia';
  for (const [regionId, countries] of Object.entries(countryGroups)) {
    if (countries.has(port.country)) return regionId;
  }
  return port.country === 'Antarctica' ? 'polar' : 'unclassified';
}

export function getTradeRegion(regionId: string): TradeRegionDefinition | undefined {
  return regionById.get(regionId);
}

export function listTradeRegions(ports: readonly CanonicalPortRecord[]) {
  return TRADE_REGIONS.map(region => {
    const members = ports.filter(port => getTradeRegionId(port) === region.id);
    const latitude = members.length ? members.reduce((sum, port) => sum + port.latitude, 0) / members.length : null;
    const longitude = members.length ? members.reduce((sum, port) => sum + port.longitude, 0) / members.length : null;
    return {
      ...region,
      portCount: members.length,
      centroid: latitude === null || longitude === null ? null : { latitude, longitude },
      samplePorts: members.slice(0, 4).map(port => ({ portId: port.portId, name: port.name, country: port.country })),
    };
  });
}
