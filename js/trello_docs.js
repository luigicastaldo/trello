// Okay I admit the code is ugly...
if (typeof console === "undefined" || typeof console.log === "undefined") { //Fix IE window.console bug
 console = {};
 console.log = function() {};
} 

  
$(document).ready(function(){
	
	var defaultOptions = {
		name: 'Custom Trello view',
        scope: {
			read: true,
            write: false
        },
        success: initDoc
    };
	if(typeof Trello==="undefined") {
		$("#view").html("<h1>Connection to Trello API is broken, Please <a href='javascript:window.reload();'>Reload</a></h1>");
	}

	Trello.authorize(_.extend({}, defaultOptions, {// Authentication
        interactive: false
    }));

    if (!Trello.authorized()) {
        return Trello.authorize(defaultOptions);
    }
    
	$(window).bind("hashchange",router);
});


var initDoc=function () {
	if (!Trello.authorized()) return Trello.authorize(defaultOptions);
	
	Trello.get('/members/me',{boards:"open",organizations:"all"}, function(me) {
		window.myself=me;
		router();
	},function(xhr){
		if (xhr.status == 401) {
			Trello.deauthorize();
			Trello.authorize(defaultOptions);
		} else {
			$("#view").html("<h1>Connection to Trello API is broken, Please <a href='javascript:reload();'>Reload</a></h1>");
		}
	});
	
};

var router=function(){
	
	var hash=location.hash.replace("#","");
	if (hash!=="")
	{
		var result = hash.split('&');
		var boardId = result[0].replace('id=',"");
		
		if(result.length > 1){
			
			getBoardPerClient(boardId);
			
		}
		else{
		
			getBoardPerUser(boardId);
			
		}
		
	}else {
		if(window.myself){
			listBoards();
		}else{
			initDoc();
		}
	}
	
};

var listBoards=function(){
	
	if(!myself.orgBoards) { // Not initiated yet
		var categories=_.groupBy(myself.boards,function(board){ // Categories Boards
			var id=board.idOrganization?board.idOrganization:"";
			return id;
		});
		var orgList=_.groupBy(myself.organizations,function(org){ // Map orgId-orgName
			return org.id;
		});

		myself.orgBoards=_.map(categories,function(value,key){ // Create Array of Organizations containing Array of Boards
			var list={};
			list.boards=value;
			if(key===""||key===null){
				list.name="Personal";
			}else if(!orgList.hasOwnProperty(key)){
				list.name="External Organization";
			}else{
				list.name=orgList[key][0].displayName
			}
			return list;
		});
		
		var tempBoard;	
		var initialLength;
		
		for(var j = 0; j < myself.orgBoards.length; j++){
			
			initialLength = myself.orgBoards[j].boards.length;
			
			for(var i = 0; i < initialLength; i++) {
				
				tempBoard = {};
				tempBoard.name = myself.orgBoards[j].boards[i].name + ' per Client';
				tempBoard.closed = myself.orgBoards[j].boards[i].closed;
				tempBoard.idOrganization = myself.orgBoards[j].boards[i].idOrganization;
				tempBoard.pinned = myself.orgBoards[j].boards[i].pinned;
				tempBoard.id = myself.orgBoards[j].boards[i].id;
				tempBoard.url = '#id=' + myself.orgBoards[j].boards[i].id + '&client=true';
				
				myself.orgBoards[j].boards[i].url = '#id=' + myself.orgBoards[j].boards[i].id;
				myself.orgBoards[j].boards.push(tempBoard);
				
			}
			
		}
		
	}	
	
	$("#view").empty();
	var template="<h1>{{fullName}} ({{username}})</h1><div id='boardlist'>"+"{{#orgBoards}}<div class='list'><h2>{{name}}</h2><ul>{{#boards}}<a href='{{url}}' ><li>{{name}}</li></a>{{/boards}}</ul></div>{{/orgBoards}}</div>";
	var str=Mustache.render(template,myself);
	$("#view").html(str);
	$("#boardlist").masonry({
		itemSelector:'.list'
	});

};

var getBoardPerUser=function(board){
	
	$("#view").empty();
	$("#view").html("<h1>Loading ...</h1>");
  
	Trello.get("/boards/"+board,{cards:"open",lists:"open",checklists:"all",members:"all"},function(board){
		
		$("#view").html("<h1>Loading ...OK!!</h1>");
		window.doc=board; //debug
		window.title=board.name;
		
		var listIdToIndex = {};
		
		function filterList(){
			
			var temp = [];
			var j = 0;
			
			for(var i = 0; i < board.lists.length; i++) {
				
				var lista = {};
				
				if(board.lists[i].name == "To Do" || board.lists[i].name == "In Progress" || board.lists[i].name == "Done"){
					lista.name = board.lists[i].name;
					lista.cards = [];
					lista.index = j;
					lista.id = board.lists[i].id;
					listIdToIndex[board.lists[i].id] = j;
					j++;
					temp.push(lista);
				}
				
			}
			
			return temp;
			
		};
		
		var unassignedUser = {};
		unassignedUser['id'] = "unassigned";
		unassignedUser['avatarHash'] = "";
		unassignedUser['confirmed'] = true;
		unassignedUser['fullName'] = "Senza Nome";
		unassignedUser['initials'] = "No User";
		unassignedUser.lists = filterList();
		
		var lMembers = board.members.reduce(function(map, obj) {
			
			if(obj.id != "56fec32951e64568882bc201"){
				map[obj.id] = obj;
				obj.lists = filterList();
			}
			return map;
		}, {});

		lMembers[unassignedUser.id] = unassignedUser;
		
		var currentDate = new Date();
		var cardDate;
		
		_.each(board.cards,function(card){ //iterate on cards
			
			cardDate = new Date(card.dateLastActivity);
			
			if((currentDate.getTime() - 2629746000) <= cardDate.getTime()){ //Showing cards active in the last month (ms 2629746000)
				if(card.idMembers.length == 0 && (card.idList in listIdToIndex)){
					
					lMembers[unassignedUser.id].lists[listIdToIndex[card.idList]].cards.push(card);
					
				}
				else{
					_.each(card.idMembers, function(user){
						
						if((card.idList in listIdToIndex) && user != "56fec32951e64568882bc201"){
							lMembers[user].lists[listIdToIndex[card.idList]].cards.push(card);
						}
						
					});
				}
			}
			
		});//iterate on cards
		
		board.users = _.values(lMembers);
			
		var htmltemplate = "<h1>Board per user</h1><div class='content'>{{#users}}<div class='cl-container'><center><h3>{{initials}}</h3></center>{{#lists}}<div class='cl-container-header'><h3>{{name}} <span class = right>{{cards.length}}</span></h3><hr><ul class='cl-container-body'>{{#cards}}<li class='cl-li'>{{name}}</li>{{/cards}}</ul></div>{{/lists}}</div>{{/users}}</div>";
		var str=Mustache.render(htmltemplate,board);
		$("#view").html(str);
		$('.content, .cl-container-body').sortable().disableSelection();

	});
	
};

var getBoardPerClient=function(board){
	
	$("#view").empty();
	$("#view").html("<h1>Loading ...</h1>");
  
	Trello.get("/boards/"+board,{cards:"open",lists:"open",checklists:"all",members:"all"},function(board){
		
		$("#view").html("<h1>Loading ...OK!!</h1>");
		window.doc=board; //debug
		window.title=board.name;
		
		var listIdToIndex = {};
		var mainClientsToShow = ['Telecom', 'Gestores', 'CGCOM', 'CdJ', 'Notartel'];
		
		function filterList(){
			
			var temp = [];
			var j = 0;
			var lista;
			
			for(var i = 0; i < board.lists.length; i++) {
				
				lista = {};
				
				if(board.lists[i].name == "To Do" || board.lists[i].name == "In Progress" || board.lists[i].name == "Done"){
					lista.name = board.lists[i].name;
					lista.cards = [];
					lista.index = j;
					lista.id = board.lists[i].id;
					listIdToIndex[board.lists[i].id] = j;
					j++;
					temp.push(lista);
				}
				
			}
			
			return temp;
			
		};
		
		function listClients(){
			
			var temp = [];
			var client;
			
			for(var i = 0; i < mainClientsToShow.length; i++) {
				
				client = {};
				client.name = mainClientsToShow[i];
				client.lists = filterList();
				client.index = i;
				client.id = mainClientsToShow[i].toLowerCase();
				temp.push(client);
				
			}
			
			return temp;
			
		};
		
		var clients = listClients();
		
		var otherClients = {};
		otherClients.name = "Others";
		otherClients.lists = filterList();
		otherClients.index = mainClientsToShow.length;
		otherClients.id = "others";
		clients.push(otherClients);
		
		var currentDate = new Date();
		var cardDate;
		var found;
		
		_.each(board.cards,function(card){ //iterate on cards
			
			cardDate = new Date(card.dateLastActivity);
			found = false;
			
			if(((currentDate.getTime() - 2629746000) <= cardDate.getTime()) && (card.idList in listIdToIndex)){ //Showing cards active in the last month (ms 2629746000)
				
				for(var i = 0; i < clients.length-1; i++) {
					
					if(card.name.toLowerCase().indexOf(clients[i].id) > 0){
						
						clients[i].lists[listIdToIndex[card.idList]].cards.push(card);
						found = true;
						break;
					}
				
				}
				
				if(!found){
					
					clients[clients.length-1].lists[listIdToIndex[card.idList]].cards.push(card);
					
				}
			}
			
		});//iterate on cards
		
		board.clients = clients;
			
		var htmltemplate = "<h1>Board per client</h1><div class='content'>{{#clients}}<div class='cl-container'><center><h3>{{name}}</h3></center>{{#lists}}<div class='cl-container-header'><h3>{{name}} <span class = right>{{cards.length}}</span></h3><hr><ul class='cl-container-body'>{{#cards}}<li class='cl-li'>{{name}}</li>{{/cards}}</ul></div>{{/lists}}</div>{{/clients}}</div>";
		var str=Mustache.render(htmltemplate,board);
		$("#view").html(str);
		$('.content, .cl-container-body').sortable().disableSelection();

	});
	
};
