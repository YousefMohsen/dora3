-I want to implement a big project where user can upload pdf files to an interface. Then be able to chat with an llm about those documeents. 

-There should be a documents screen where user can create datasets(folders) that contain documents.

-Then the default shuold be a chat interface where user can chat and ask.  Then interface can be minimalistic. 



## Main vision of the project: 
-it shuold return answers based only on the knowledge base and not its own training. 
-it should be able to quickly search in the documents
-my plan is to have a processing step for the documents where i make rag/graphraq/chunks/embeddings and make an agent that can quickly look in the documents and give some meningful answers as well as sources to the answers. My plan is to have some database for indexing like a vector db or postgress db to help making the look up easier. 
-then i will build an agent that can do steps (and maybe a loop ) until it can give a meingful answwr.


## phase 1: research how claude code is implemented 
I have downloaded some documentaiton and some code from the claude code for you. You should look at it and find out if similar setup can be used in my new project. Should have big inspiration from claude code.

Phase 1 output: project_reccomendation.md document. containing an analysis where you find out what elements from claude code can be used in my new project. and write how you suggest to implement that. and make a brain  storm steps where you suggest whats the best way to implement my agent. should it be rag, should it be just embeddings, what should it be? 

p.s. I've put all claude code documentaiotn and code inside ./inspiration folder. There is a inspiration/readme.md that you should read first

## phase 2: init project and general requirments
-I want to init a typescrupt, NextJs projct.
-I should have two main screens. /chat and /documents
-in the /chat there should be a conversation panel on the left. and the main chat in the middle. and a panel on the right that we will use for multi porpuses later. but make space so it can open a panel in the right. 
-the chat should be able to talk with openai via openai_api_key and model. and also with openrouter using a key and a model name. 
-i should be able to provide in the .env files the api keys for OPENAI_API_KEY and OPENROUTER_API_KEY

-in the left panel it should show a settings icon when clicked it should show settings screen. HEre i can choose if i want openai or openrouter. and choose model from each one. 
-selection should be saved even if i restart. Conversations too. can be stored in local storage.


Phase 2 output: chat interface where i can chat with open ai and open router models directly via a nextjs project. 



## Phase 3: uploading the fils

There should be a button in the conversation panel over settins saying documents. when clicked user should go to /documents.
-there user can see the created subsets. User can also create a new subset. A subset has a name and documents.
-when a subset is clicked user can see documents and can upload more documents.
-User should be able to delete document by selecteing its checkbox and clicking "delete" button. 

-for now we want a minimalistic version where documents are stored locally. but later I will implement some remote bucket/google drive or similar thing. but for now just store locally in the project. 

-in the subset screen there should be a button in the top saying "index subset" when clicked it should index. for now make a dummy button only that just console logs something. 

-next to each document it should show a status if its indexed or not. for now just dummy, we will connect to db later. 


## phase 4
Processing the documents. There should be a setup where i can process the documents so its easier for the agents to understand. Like postgress db. it shuold be easy to start it locally. like docker-compose-db.yml to start a postress that the processing job can talk to.

## Phase 5:
The actual agent. I want to see how claude code was implemented. what tools, loops etc was used and try to do something similar. This phase i will describe later when phase 1 is done. 

