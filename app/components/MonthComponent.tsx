import type { Measurement, Month } from '~/utils/types';
import type { LinksFunction } from '@remix-run/node';
import { getMonthlyInformation } from '~/utils/strom-utils';
import styles from './MonthComponent.css';
import { countUniqueDays } from '~/utils/date-utils';

const getLastRegisteredHour = (
  measurements: Measurement[]
): Measurement => {
  return measurements[measurements.length - 1];
};

const padWithZero = (num: number): string => {
  if (num > 99) {
    throw new Error(
      'pad with zero not supported for numbers with three digits'
    );
  }
  if (num < 10) {
    return `0${num}`;
  }
  return `${num}`;
};

const getDayString = (measurement: Measurement) => {
  const date = new Date(measurement.from);
  const year = date.getFullYear();
  const month = padWithZero(date.getMonth() + 1);
  const day = padWithZero(date.getDate());
  return `${year}-${month}-${day}`;
};

const countByDay = (measurements: Measurement[]) => {
  const inital: {
    [day: string]: { usage: number; cost: number; vat: number };
  } = {};
  const data = measurements.reduce((data, measurement) => {
    const day = getDayString(measurement);
    if (data[day]) {
      return {
        ...data,
        [day]: {
          usage: data[day].usage + measurement.consumption,
          cost: data[day].cost + measurement.cost,
          vat:
            data[day].vat +
            measurement.unitPriceVAT * measurement.consumption,
        },
      };
    }
    return {
      ...data,
      [day]: {
        usage: measurement.consumption,
        cost: measurement.cost,
        vat: measurement.unitPriceVAT * measurement.consumption,
      },
    };
  }, inital);
  return Object.entries(data).map(([key, data]) => ({
    ...data,
    date: key,
  }));
};

export const links: LinksFunction = () => {
  return [{ rel: 'stylesheet', href: styles }];
};

const oerePerKwh = (kroner: number): string => {
  return `${Math.round(kroner * 100)} øre/kwh`;
};

const getKr = (num: number): string => {
  return `${Math.round(num)} kr`;
};

interface Props {
  month: Month;
}

const EL_AVGIFT_PER_KWH = 15.41;
const PAASLAG_PER_KWH = 0.01;

const TIBBER_FASTPRIS_KR = 39;

export const MonthComponent = ({ month }: Props) => {
  const { monthName } = month;

  const {
    totalUsage: {
      consumption,
      consumptionUnit,
      cost,
      unitPrice,
      unitPriceVAT,
    },
    nettleie: { fastledd, energiledd },
  } = getMonthlyInformation(month);
  const price = unitPrice - PAASLAG_PER_KWH;
  const spotWithoutMva = price - unitPriceVAT;
  const estimatedAllowance = Math.round(
    (spotWithoutMva - 0.7) * 0.9 * consumption * 1.25
  );
  const utenPaaslag =
    cost -
    PAASLAG_PER_KWH * consumption -
    (EL_AVGIFT_PER_KWH / 100) * consumption;

  const sumNettleie = Math.round(
    energiledd.dag.cost / 100 +
      energiledd.natt.cost / 100 +
      fastledd.cost
  );

  const totalKostnad = Math.round(
    TIBBER_FASTPRIS_KR + sumNettleie + cost - estimatedAllowance
  );

  const numDaysCounted = countUniqueDays(
    month.measurements.map(({ from }) => new Date(from))
  );

  const lastRegisteredMeasurement = getLastRegisteredHour(
    month.measurements
  );

  return (
    <div className="wrapper">
      <section>
        <h3>Strømforbruk for {monthName}</h3>
        <dl>
          <dd></dd>
          <dt>
            <strong>Kostnad for {monthName}</strong>
          </dt>
          <dd>
            {Math.round(cost)} kroner ({Math.round(consumption)}{' '}
            {consumptionUnit})
          </dd>
          <dt>
            <strong>Data frem til</strong>
          </dt>
          <dd>
            {new Date(lastRegisteredMeasurement.to).toLocaleString(
              'no-NB'
            )}
          </dd>
        </dl>
      </section>

      <section>
        <h3>Spotpriser</h3>
        <table className="spotpriser">
          <thead>
            <tr>
              <th></th>
              <th>Med mva</th>
              <th>Uten mva</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Spotpris</td>
              <td>{oerePerKwh(price)}</td>
              <td>{oerePerKwh(spotWithoutMva)}</td>
            </tr>
            <tr>
              <td>Forbruk snitt</td>
              <td>{oerePerKwh(utenPaaslag / consumption)}</td>
              <td>{oerePerKwh((utenPaaslag / consumption) * 0.8)}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <section>
        <h3>Strømforbruk</h3>
        <dl className="container">
          <dt>Totalpris for {monthName}</dt>
          <dd>{Math.round(cost)} kr</dd>
          <dt>Estimert stønad</dt>
          <dd>- {estimatedAllowance} kr</dd>
          <dt>Faktisk strømkostnad</dt>
          <dd>{Math.round(cost - estimatedAllowance)} kr</dd>
        </dl>
      </section>
      <section>
        <h3>Nettleie</h3>
        <dl className="container">
          <dt>Fastledd {fastledd.name}</dt>
          <dd>{fastledd.cost} kr</dd>
          <dt>
            Energiledd dag ({Math.round(energiledd.dag.consume)} kwh)
          </dt>
          <dd>{Math.round(energiledd.dag.cost / 100)} kr</dd>
          <dt>
            Energiledd natt ({Math.round(energiledd.natt.consume)}{' '}
            kwh)
          </dt>
          <dd>{Math.round(energiledd.natt.cost / 100)} kr</dd>
        </dl>
      </section>

      <section>
        <h3>Totalkostnader for {monthName}</h3>
        <dl className="container">
          <dt>Fastpris Tibber</dt>
          <dd>{TIBBER_FASTPRIS_KR} kr</dd>
          <dt>Sum nettleie</dt>
          <dd>{sumNettleie} kr</dd>
          <dt>Strømkostnader</dt>
          <dd>{Math.round(cost)} kr</dd>
          <dt>Strømstønad</dt>
          <dd>- {estimatedAllowance} kr</dd>
          <dt>Sum</dt>
          <dd>{totalKostnad} kr</dd>
        </dl>
      </section>

      <section>
        <h3>Kostnader per dag ({numDaysCounted} dager totalt)</h3>
        <dl className="container">
          <dt>Kost</dt>
          <dd>{getKr(totalKostnad / numDaysCounted)}</dd>
        </dl>
      </section>

      <section className="day-overview">
        <h3>Per dag</h3>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Kostnad</th>
              <th>Bruk</th>
              <th>Forbruk</th>
              <th>Stønad</th>
              <th>Faktisk</th>
            </tr>
          </thead>
          <tbody>
            {countByDay(month.measurements)
              .sort((one, two) => {
                return one.date < two.date ? 1 : -1;
              })
              .map((entry) => {
                const estimatedAllowance = Math.round(
                  (spotWithoutMva - 0.7) * 0.9 * entry.usage * 1.25
                );
                const diff = entry.cost - estimatedAllowance;
                return (
                  <tr key={entry.date}>
                    <td>{entry.date}</td>
                    <td>{getKr(entry.cost)}</td>
                    <td>{Math.round(entry.usage)} kwh</td>
                    <td>{oerePerKwh(entry.cost / entry.usage)}</td>
                    <td>{getKr(estimatedAllowance)}</td>
                    <td className={diff > 0 ? 'red' : 'green'}>
                      {getKr(diff)}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </section>
    </div>
  );
};
