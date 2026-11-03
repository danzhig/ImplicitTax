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
        <h2>How borrowing is split</h2>
        <ul>
          <li><b>Your share</b> of a government's deficit = the taxes you pay it × (its deficit ÷ its tax revenue). If Ottawa borrows 9¢ for every $1 of tax,
            your federal taxes are effectively 9% higher.</li>
          <li><b>Interest is counted once.</b> Interest on past debt is already part of this year's spending. Some of it is paid by your taxes and some is borrowed.
            Interest counts as borrowed first, so "borrowed to pay interest" is the compounding part: debt growing just to service itself.</li>
          <li>Surplus years produce a <b>credit</b> (negative borrowing).</li>
          <li><b>Deficit measure:</b> the accrual operating balance from Statistics Canada's government finance statistics (revenue minus expenses, where expenses
            include depreciation, so roads and buildings are spread over their useful life). This is a consistent standard across levels, but it is not the same
            as the deficit in provincial budget documents. For example, Ontario reported a $1.1B deficit for 2024-25, while this measure shows about $16B, mainly
            because Ontario's own accounts include profits of provincially owned businesses (OPG, LCBO, Hydro One) and pension gains.</li>
          <li><b>Provinces</b> include their hospitals, school boards, colleges and universities. <b>Cities</b> use all municipalities in the province as a stand-in.
            StatCan's city-level figures for Toronto, Calgary and Vancouver (2018-2020) show similar ratios.</li>
          <li><b>CPP</b> is a pre-funded pension plan outside the government budgets, so it is counted as a tax you pay but never gets a deficit share.</li>
          <li><b>History</b> holds your persona and today's tax rules fixed and applies each year's borrowing and interest ratios.</li>
          <li><b>Inflation is excluded on purpose.</b> Deficits are already counted in full, and inflating debt away is one way they get paid, so counting both would be
            double counting.</li>
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
