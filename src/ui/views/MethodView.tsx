import consumption from '../../../data/consumption/ca.json';
import { FISCAL_NOTES } from '../../engine';

export function MethodView() {
  return (
    <div className="view prose">
      <section className="block">
        <h2>What the number means</h2>
        <p><b>Implicit income tax rate</b> = (every tax you pay now + your share of what each government borrowed this year) ÷ your gross income.
          Gross income is what you'd quote as your income: salary, self-employment profit and investment income. Employer-side contributions never reach your
          paycheque, so they are shown for context only.</p>
        <p>Government borrowing is treated as a delayed tax: spending done on your behalf now that someone has to pay for later.</p>
      </section>
      <section className="block">
        <h2>How borrowing is counted</h2>
        <ul>
          <li><b>Borrowing = the increase in a government's net debt</b> (its debts minus its financial assets) over the year. That is the money actually
            borrowed on your behalf: operating deficits plus borrowing for roads, transit and buildings. It only goes negative when a government pays debt down.</li>
          <li><b>Your share</b> = the taxes you pay that government × (what it borrowed ÷ its tax revenue). If Ottawa's net debt rose 12¢ for every $1 of tax it
            collected, your federal taxes are effectively 12% higher.</li>
          <li><b>Interest</b> on past debt is shown separately. It is already part of what your taxes pay for, so it is never added again.</li>
          <li><b>Sources, chosen to avoid accounting adjustments:</b> federal public-accounts net debt (Statistics Canada); each province's own published
            net debt (Ontario budgets, Alberta annual reports, BC Financial and Economic Reviews); municipal net borrowing from the national accounts, which
            records only actual transactions. CPP and QPP are separate pension funds and are excluded, and pension-fund surpluses never reduce debt here.</li>
          <li><b>Provinces</b> include their hospitals, school boards, colleges and universities. <b>Cities</b> use all municipalities in the province as a
            stand-in. Municipalities mostly run surpluses because they may not borrow for operating costs.</li>
          <li><b>History</b> holds your persona and today's tax rules fixed and applies each year's borrowing and interest. Years are fiscal years starting
            in April (2016 = 2016-17), except municipal years, which are calendar years.</li>
          <li><b>Inflation is excluded on purpose.</b> Borrowing is already counted in full, and inflating debt away is one way it gets paid, so counting both
            would be double counting.</li>
        </ul>
      </section>
      <section className="block">
        <h2>Canada: what's modelled</h2>
        <ul>
          <li>2026 federal and provincial income tax (Alberta, Ontario, BC): brackets, basic personal amounts, spouse amount, Canada employment amount, dividend tax
            credits, half of capital gains, Ontario surtax and health premium, Ontario and BC low-income reductions.</li>
          <li>CPP, CPP2 and EI, including both sides: base CPP and EI earn non-refundable credits, while enhanced CPP and CPP2 are deductions. The self-employed pay both
            halves and deduct the employer half. Each contribution shows how much income tax it gives back.</li>
          <li>Sales taxes at the rates households actually pay: StatCan table 36-10-0432 (sales taxes by spending category and province, 2024). The grocery share falls
            with income (Survey of Household Spending 2023: {consumption.groceryShareCurve.map((c) => `${Math.round(c.groceryShare * 100)}%`).join(' → ')} from the lowest to
            the highest income fifth).</li>
          <li>Fuel taxes per litre with GST/HST on top, home energy, vehicle sales tax and the federal luxury tax, and tariffs (federal customs revenue ÷ household spending).</li>
          <li>Property tax split into city, regional and provincial education parts; land transfer tax and development charges spread over the years you keep the home;
            renters pay property tax through rent (estimate, can be turned off).</li>
          <li>Canada Child Benefit, netted only when "net of cash transfers" is on.</li>
        </ul>
        <h3>Known gaps</h3>
        <ul>
          <li>Not yet modelled: alternative minimum tax, OAS clawback and age amount, Alberta's supplemental credit, provincial child benefits, GST/HST credit.</li>
          <li>Development charges are sourced for Calgary only (2026 off-site levy); Toronto and Vancouver are still to be sourced.</li>
          <li>Toronto assessed values are estimated at 85% of market value because Ontario still uses 2016 assessments.</li>
          <li>Some parameters still need confirming against official sources (listed in data/rules/ca/RESEARCH.md): Canada employment amount, RRSP limit, provincial spouse
            amounts and dividend credit rates, BC upper bracket thresholds, Ontario and BC tax reduction amounts.</li>
          <li>2026 fuel tax relief (federal excise suspended for part of the year, Alberta's tax paused from October) is noted but the regular rates are used.</li>
        </ul>
      </section>
      <section className="block">
        <h2>Data notes</h2>
        <ul>{FISCAL_NOTES.map((n) => <li key={n}>{n}</li>)}</ul>
        <ul>{consumption.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        <p className="fine">Not tax advice. Everything runs in your browser; personas are stored only on your device.</p>
      </section>
    </div>
  );
}
