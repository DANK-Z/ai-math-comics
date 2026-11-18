\# AI Math Comics — Demo API



Backend: http://127.0.0.1:8000

Frontend: http://localhost:5173

Allow the frontend origin in FastAPI CORS.



\## GET /api/comics/pizza-fractions?lang=ru



Supported languages: ru, kk.

Response: {"id":"pizza-fractions","lang":"ru","title":"...",

"panels":\[{"id":1,"speaker":"...","text":"...","imageKey":"pizza-01"}],

"exercise":{"id":"pizza-share","panelId":4,"prompt":"..."}}



Return six panels. The question asks how much pizza each friend gets when

three identical pizzas are shared equally among four friends.

The frontend maps imageKey to its local illustration or placeholder.



\## POST /api/exercises/pizza-share/check



Request: {"answer":"6/8","lang":"ru"}

Response: {"status":"correct","message":"..."}



Supported statuses: correct, incorrect, invalid.

Use exact fraction arithmetic. Accept 3/4 and equivalent fractions.

Return localized feedback. A zero denominator is invalid.



\## GET /api/exercises/pizza-share/hints?lang=ru\&step=1



Supported steps: 1, 2.

Response: {"step":1,"text":"...","hasMore":true}



Return localized hints that guide the student without giving the answer.

