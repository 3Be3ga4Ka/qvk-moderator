export function repLevel(score){const n=Number(score)||0;if(n>=100)return ["💎","Легенда"];if(n>=50)return ["👑","Элита"];if(n>=20)return ["🌟","Эксперт"];if(n>=5)return ["✨","Активист"];if(n<0)return ["🌧️","В минусе"];return ["🌱","Новичок"];}
export function escapeHtml(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
export function repCard(mode,user,score,rank=null){
 const level=repLevel(score),badge=mode==="testers"?"🧪 ТЕСТИРОВЩИК QVK":"💜 УЧАСТНИК QVK";
 const name=escapeHtml(user.name||"Участник"),handle=user.username?" · @"+escapeHtml(user.username.replace(/^@/,"")):"";
 return "<b>╭────────────╮</b>\n<b> "+badge+"</b>\n<b>╰────────────╯</b>\n\n"+
 "<b>"+name+"</b>"+handle+"\n"+"🏆 Репутация: <b>"+(score>0?"+":"")+score+"</b>\n"+
 level[0]+" Звание: <b>"+level[1]+"</b>"+(rank?"\n🏅 Место в рейтинге: <b>#"+rank+"</b>":"")+
 "\n<tg-spoiler>ID "+escapeHtml(user.id)+"</tg-spoiler>\n\n<i>Репутация относится только к этой группе.</i>";
}
export function repTopCard(mode,rows){return "<b>🏆 "+(mode==="testers"?"Рейтинг тестировщиков":"Рейтинг сообщества")+"</b>\n\n"+(rows.length?rows.map((x,i)=>(["🥇","🥈","🥉"][i]||"▫️")+" <b>"+escapeHtml(x.name||"Участник")+"</b>"+(x.username?" · @"+escapeHtml(x.username.replace(/^@/,"")):"")+" — <b>"+(x.score>0?"+":"")+x.score+"</b> "+repLevel(x.score)[0]).join("\n"):"🌱 Пока нет оценок.")+"\n\n<i>Ответь + или − на сообщение участника, чтобы оценить его.</i>";}
export const cardButtons=target=>({inline_keyboard:[[{text:"👍 +1",callback_data:"rv:1:"+target},{text:"👎 −1",callback_data:"rv:-1:"+target}],[{text:"🔄 Обновить",callback_data:"rc:"+target}]]});
