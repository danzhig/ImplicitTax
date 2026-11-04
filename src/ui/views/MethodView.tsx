import consumption from '../../../data/consumption/ca.json';
import usConsumption from '../../../data/consumption/us.json';
import euConsumption from '../../../data/consumption/eu.json';
import sgConsumption from '../../../data/consumption/sg.json';
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
          <li><b>Sources (Canada), chosen to avoid accounting adjustments:</b> federal public-accounts net debt (Statistics Canada); each province's own published
            net debt (Ontario budgets, Alberta annual reports, BC Financial and Economic Reviews); municipal net borrowing from the national accounts, which
            records only actual transactions. CPP and QPP are separate pension funds and are excluded, and pension-fund surpluses never reduce debt here.</li>
          <li><b>Sources (US):</b> federal borrowing is the change in debt held by the public (OMB Historical Tables), so trust-fund balances such as Social
            Security never offset it. States and local governments use the Census Bureau's Annual Survey of State and Local Government Finances: the change in
            total debt outstanding, or long-term debt issued minus retired where survey formats change. US states report gross debt, not net debt, so their
            savings funds are not subtracted.</li>
          <li><b>Provinces</b> include their hospitals, school boards, colleges and universities. <b>Cities</b> use all municipalities in the province as a
            stand-in; US cities use all local governments in the state (counties, cities, school and special districts). Municipalities mostly run surpluses because they may not borrow for operating costs.</li>
          <li><b>History</b> holds your persona and today's tax rules fixed and applies each year's borrowing and interest. Canadian years are fiscal years starting
            in April (2016 = 2016-17), except municipal years, which are calendar years. US federal years end September 30; state and local years are
            the governments' own fiscal years ending in that year.</li>
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
        <h2>United States: what's modelled</h2>
        <ul>
          <li>2026 federal income tax after the 2025 tax law: brackets, $16,100 standard deduction, the $40,400 state-and-local tax deduction cap (phased down above
            $505,000), $2,200 child tax credit, 0/15/20% rates on dividends and long-term gains, 3.8% net investment income tax, senior deduction.</li>
          <li>Filing status follows the persona: single, or married filing jointly with a partner.</li>
          <li>Payroll: Social Security 6.2% up to $184,500, Medicare 1.45% plus 0.9% above $200,000. The self-employed pay both halves and deduct half. State programs:
            New York paid family leave and disability, California SDI, Washington paid leave and WA Cares. US payroll taxes give no income tax credit except
            the self-employed deduction.</li>
          <li>State and city income tax: New York (with its high-income recapture) and New York City; California (2025 schedules, the latest published, plus the
            1% surcharge over $1M); Washington's capital gains tax; Texas has none.</li>
          <li>Sales tax at the rate households actually pay on their spending basket ({usConsumption.notes[2]}).</li>
          <li>Property tax by city, including homestead exemptions; transfer taxes (NYC mansion and mortgage recording taxes, San Francisco transfer tax,
            Washington and Seattle excise tax) spread over the years you keep the home. Fuel, vehicle taxes and tariffs as in Canada.</li>
        </ul>
        <h3>Known gaps</h3>
        <ul>
          <li>No alternative minimum tax, earned income credit, state credits for renters or children, or Social Security benefit taxation.</li>
          <li>California has not published 2026 schedules yet; 2025 schedules are used.</li>
          <li>New York City and Seattle property tax rates are effective-rate estimates; San Francisco transfer tax tiers and Houston impact fees still need checking.</li>
          <li>2001 and 2003 state and local borrowing use national ratios (the Census only published US totals those years) and are marked as estimates.</li>
        </ul>
      </section>
      <section className="block">
        <h2>Europe: what's modelled</h2>
        <ul>
          <li><b>Borrowing</b> is national-accounts net borrowing (B.9) by level of government, from Eurostat (Switzerland, Germany, Luxembourg, Ireland, Norway,
            Denmark), the ONS for the UK and Statistics Denmark for its latest years. Social security funds are left out, like the CPP: Luxembourg's and
            Switzerland's build large pension reserves. Norway's central government includes the oil fund, so it shows saving, not borrowing. That credit is kept on purpose: unlike the CPP, whose assets belong to its members and can only pay pensions, the oil fund is owned by the state and pays part of the budget every year.</li>
          <li><b>Germany (Munich):</b> 2026 tariff, solidarity surcharge, 25% flat tax on capital income, church tax (optional); pension, health, care and
            unemployment insurance, with pension, health and care deducted from taxable income; Kindergeld or the child allowance, whichever is better. Income tax and
            VAT are shared between the federal government, Bavaria and Munich in their legal proportions.</li>
          <li><b>Switzerland (Zurich):</b> federal, cantonal (95%) and city (119%) income and wealth tax from the official 2026 tariffs; imputed rent on owned homes
            with mortgage interest deductible; AHV/IV/EO and unemployment insurance. Pillar 2 and mandatory health insurance premiums are shown but not counted
            (mandatory savings and insurance, decision D2).</li>
          <li><b>United Kingdom (London):</b> 2026-27 income tax by slices (earnings, savings, dividends), capital gains tax, National Insurance, council tax (also paid by
            tenants), stamp duty land tax, child benefit with the high income charge.</li>
          <li><b>Luxembourg, Ireland, Norway, Denmark:</b> 2026 income tax scales and credits; Luxembourg's employment fund surcharge and dependency insurance; Ireland's
            USC and PRSI; Norway's bracket tax, national insurance and wealth tax (homes at 25%); Denmark's AM-bidrag, municipal tax and the new 2026 middle tax.</li>
          <li><b>VAT</b> is the share of everyday spending that goes to VAT, from Eurostat spending weights by category and each country's 2026 rates:{' '}
            {Object.entries(euConsumption.countries).map(([c, v]) => `${c} ${(v.vatShareOfSpending * 100).toFixed(1)}%`).join(', ')}.</li>
        </ul>
        <h3>Known gaps</h3>
        <ul>
          <li>Bavaria, Zurich and every European city are shown through all governments at their level (all Länder, all cantons, all local governments).</li>
          <li>Car registration taxes (Norway, Denmark, Ireland) and home energy taxes are simplified; Oslo's property tax and Luxembourg's family allowance are estimates.</li>
          <li>Newcomer regimes (UK FIG, Danish researcher scheme, Irish SARP, Swiss lump-sum) are not modelled; Luxembourg single parents use class 1.</li>
        </ul>
      </section>
      <section className="block">
        <h2>Singapore: what's modelled</h2>
        <ul>
          <li>Income tax at resident rates (0%-24%) for income earned in 2026 (YA 2027). Dividends, bank interest and capital gains are not taxed.</li>
          <li><b>CPF</b> (20% of wages up to S$102,000) goes into your own accounts, so it is shown for context but not counted as tax, like Swiss pillar 2
            (decision D2). Its income tax relief is counted. Foreigners on work passes pay no CPF (tick "buying as a foreigner").</li>
          <li><b>Cars:</b> the certificate of entitlement (COE, 2026 average S$121,792 for small cars) is bought from the government, so it counts as a car tax,
            spread over its 10 years; plus the additional registration fee (100%-250% of the car's value, partly refunded when deregistered), 20% excise, GST
            and road tax.</li>
          <li>Property tax on the annual value (owner-occupier rates 0%-32%, with the 2026 rebate); buyer's stamp duty 1%-6%; 60% extra for foreign buyers.</li>
          <li>GST 9% on almost everything: {(sgConsumption.gstShareOfSpending * 100).toFixed(1)}% of everyday spending.</li>
          <li><b>Borrowing</b> is minus the official overall budget surplus, which includes the yearly contribution from reserve returns (decision D22, like
            Norway's oil fund). Singapore issues bonds only to invest, so FY2020's deficit was paid from past reserves.</li>
        </ul>
        <h3>Known gaps</h3>
        <ul>
          <li>No net debt or net asset figure (the reserves are not disclosed), so the debt chart is empty for Singapore; fiscal history starts in FY2005.</li>
          <li>The GST share, home energy taxes and the ARF tiers are estimates; one-off household payouts (GST vouchers, CDC vouchers) are not modelled.</li>
        </ul>
      </section>
      <section className="block">
        <h2>Data notes</h2>
        <h3>Canada</h3>
        <ul>{FISCAL_NOTES.CA.map((n) => <li key={n}>{n}</li>)}</ul>
        <ul>{consumption.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        <h3>United States</h3>
        <ul>{FISCAL_NOTES.US.map((n) => <li key={n}>{n}</li>)}</ul>
        <ul>{usConsumption.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        <h3>Europe</h3>
        <ul>{FISCAL_NOTES.EU.map((n) => <li key={n}>{n}</li>)}</ul>
        <ul>{euConsumption.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        <h3>Singapore</h3>
        <ul>{FISCAL_NOTES.SG.map((n) => <li key={n}>{n}</li>)}</ul>
        <ul>{sgConsumption.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        <p className="fine">Not tax advice. Everything runs in your browser; personas are stored only on your device.</p>
      </section>
    </div>
  );
}
