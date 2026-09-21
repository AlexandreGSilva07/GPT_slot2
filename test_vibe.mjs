import { runVibeBenchmark500 } from './vibe_benchmark_500.js';
const r=runVibeBenchmark500();
console.log(JSON.stringify({total:r.total,passed:r.passed,failed:r.failed,passRate:r.passRate,totalDurationMs:r.totalDurationMs,byCategory:r.byCategory},null,2));
if(r.failed){
  for(const x of r.results.filter(x=>!x.pass).slice(0,30)){
    console.log('\nFAIL',x.id,x.prompt);
    for(const c of x.checks.filter(c=>!c.pass)) console.log(c.name,'expected=',c.expected,'actual=',c.actual);
    console.log(x.result.missing);
  }
  process.exit(1);
}
