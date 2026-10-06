VISUAL STUDIO 2022 ME RUN KARNE KE STEPS
=========================================
Requirements: Visual Studio 2022 (ASP.NET workload) + .NET 8 SDK
              (Angular dobara build karna ho to Node.js 18/20 LTS)

1. Zip ko extract karo.
2. Angulr_dotnetCore_Calculator.sln ko Visual Studio 2022 me kholo.
3. Upar "http" ya "https" profile select karke F5 (ya Ctrl+F5) dabao.
   Browser me http://localhost:5000 khulega.

wwwroot me Angular ka build pehle se hai, isliye Node/npm ke bina bhi chalega.

Angular code badalna ho (ClientApp/src):
  cd ClientApp
  npm install
  npm run build        -> wwwroot update ho jayega, phir VS me F5

Angular dev mode (live reload), optional:
  Terminal 1: VS me http profile run karo (port 5000)
  Terminal 2: cd ClientApp && npm start   -> http://localhost:4200
  (/api calls proxy.conf.json se 5000 par jati hain)
