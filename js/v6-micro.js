/* v6: Minerals in your food, a 7-day card at the foot of the Nutrition page (Provisions Hall). Not part of the original.
   What it draws: the sodium, potassium and magnesium (mg) that foods you logged carry on their own entries (m.na, m.k, m.mg),
   which Luke's web lookup saves (js/v6-addfood.js, with the sources he used; null when no source gives a value).

   HONEST BY DESIGN (AGENTS.md, docs/DISCLAIMERS.md)
   * A food with no saved value adds nothing and is never counted as 0. A day's bar is the SUM OF THE FOODS THAT HAD A VALUE, so it is a
     minimum, never the whole day's intake. Each day says how many of its logged foods had a value.
   * A day with no value at all is a gap (no bar), not a zero. A week with none shows how to get values, not an empty chart.
   * The values are estimates found by an AI web search (or a canteen-dish lookup), not measurements.
   * No target or "recommended" line: no daily-intake source for these three is in js/v6-sources.js, so none is shown or invented.
   * Nothing is saved or changed here; the card only reads the food log. Foods with no mineral data (menu foods have kcal only) are
     counted in "n of m foods" so the gap is visible.
   Calcium, vitamin D and K2 are not drawn: nothing in the app stores them. */
const HWMicro=(()=>{
const MIN=[['na','Sodium','var(--gold)'],['k','Potassium','var(--grn)'],['mg','Magnesium','var(--vio)']];
const val=(e,k)=>{const x=e&&e.m?e.m[k]:null;return typeof x==='number'&&isFinite(x)&&x>=0?x:null};
/** One day for one mineral: {d, total (mg, null with no value), n foods that had a value, of foods logged}. */
function day(d,k,L){L=L||A('food',d);let s=0,n=0;L.forEach(e=>{const v=val(e,k);if(v!=null){s+=v;n++}});return{d,total:n?Math.round(s):null,n,of:L.length}}
const week=()=>{const R=rng(7),L=Object.fromEntries(R.map(d=>[d,A('food',d)]));return{days:R,rows:R.map(d=>({d,cov:L[d].length,m:Object.fromEntries(MIN.map(([k])=>[k,day(d,k,L[d])]))}))}};
const fmt=x=>x==null?'–':(+x).toLocaleString('en',{maximumFractionDigits:0});
const dl=d=>new Date(d+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'});
function card(){const W=week(),any=W.rows.some(r=>MIN.some(([k])=>r.m[k].total!=null));
  let h='<div class="card mncard" id="mn-card"><h3>MINERALS IN YOUR FOOD · LAST 7 DAYS</h3>'
    +'<p class="mut">Sodium, potassium and magnesium from the foods you logged that carry a looked-up value. These are estimates from web sources, not measurements. A bar adds up only the foods that had a value, so it is a minimum, not your whole day. There is no target line: none is cited here.</p>';
  if(!any)return h+'<div class="mnempty" role="status"><b>NO MINERAL VALUES YET</b><p class="mut">Foods from the canteen menu list calories only. Log a food with <b>Add More Food</b> and Luke looks up sodium, potassium and magnesium with the source he used. Days with nothing stay blank, never zero.</p></div></div>';
  MIN.forEach(([k,n,c])=>{const v=W.rows.map(r=>r.m[k].total),has=v.filter(x=>x!=null).length;
    h+='<div class="mnrow" id="mn-'+k+'"><h4>'+n+' (mg)</h4>'+(has?chart(v,W.days,c,'mg'):'<p class="mut">No '+n.toLowerCase()+' value on any logged food this week.</p>')
      +'<small class="mut">'+(has?has+' of 7 days have a value.':'')+'</small></div>'});
  h+='<details class="mntab"><summary>Show as a table</summary><table class="mnt"><tr><th scope="col">Date</th>'+MIN.map(m=>'<th scope="col">'+m[1]+' mg</th>').join('')+'<th scope="col">Foods with a value</th></tr>'
    +W.rows.slice().reverse().map(r=>'<tr><th scope="row">'+esc(dl(r.d))+'</th>'+MIN.map(([k])=>'<td>'+fmt(r.m[k].total)+'</td>').join('')
      +'<td>'+(r.cov?MIN.map(([k])=>r.m[k].n).reduce((a,b)=>Math.max(a,b),0)+' of '+r.cov:'none logged')+'</td></tr>').join('')
    +'</table><small class="mut">A dash means no logged food had a value that day. The last column shows the most foods that had a value for any one mineral. HealthWiz is a wellness tracker, not a medical device.</small></details></div>';
  return h}
HWUI.css('micro',`
.mncard h4{margin:12px 0 4px}.mnrow small{display:block;margin-top:2px}.mnempty{border:2px dashed var(--ln);padding:10px;margin-top:8px}
.mnt{width:100%;border-collapse:collapse;margin:6px 0;font-size:.85em}.mnt th,.mnt td{padding:4px 6px;text-align:right;border-bottom:1px solid var(--ln)}.mnt th:first-child{text-align:left}
.mntab{margin-top:10px}.mntab summary{cursor:pointer}`);
{const p=pages.food;pages.food=function(){return p.apply(this,arguments)+card()}}
return{day,val,MIN}})();
