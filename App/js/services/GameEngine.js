"use strict";
gameApp.factory('GameEngine', function(GraphicsEngine, GameBoard, GlobalSettings, KeyPressHandler, Utils) {
    return {
        // TODO:
        centipedeFramesPerMove: 2,

        initialise: function(canvas, graphicsFile, gameBoardSize, gameState) {
            GraphicsEngine.initialise(canvas, graphicsFile, gameBoardSize.scale);
            GameBoard.initialise(gameBoardSize.width, gameBoardSize.height);

            this.canvas = canvas;
            this.gameBoardSize = gameBoardSize;
            this.gameState = gameState;

            this.bullets = [];
            this.centipedes = [];
            this.scoreMarkers = [];

            var me = this;

            this.centipedes.push(new Centipede(
                Math.floor(gameBoardSize.width / 2),
                0,
                10,
                (gameBoardSize.height - GlobalSettings.playerAreaHeight) + 1,
                gameBoardSize.height - 1,
                0,
                gameBoardSize.width - 1,
                this.centipedeFramesPerMove,
                DirectionEnum.Down,
                DirectionEnum.Right,
                this.gameBoardCollisionCheck,
                function(centipede) { me.generateNewCentipede(centipede)}
            ));

            this.player = new Player(
                Math.floor(gameBoardSize.width / 2),
                gameBoardSize.height - 1,
                function(x, y) { me.fireBullet(x, y)});
        },

        update: function(animation) {
            this.moveBullets();
            this.moveFlea(animation);
            this.moveSpider(animation);
            this.moveSnail(animation);
            this.moveCentipedes(animation);
            this.movePlayer(animation);
            this.moveScoreMarkers(animation);

            if (animation == 0) {
                this.checkCreateFlea();
                this.checkCreateSpider();
                this.checkCreateSnail();
            }

            this.drawBoard();
            this.drawPlayer(animation);
            this.drawFlea(animation);
            this.drawSpider(animation);
            this.drawSnail(animation);
            this.drawCentipedes(animation);
            this.drawBullets();
            this.drawScoreMarkers();
        },

        fireBullet: function(x, y) {
            if (this.bullets.length >= GlobalSettings.maxBulletsOnScreen) {
                return;
            }

            var me = this;
            this.bullets.push(new Bullet(x, y, function(x, y) { return me.checkBulletCollision(x, y)}));
        },

        checkBulletCollision: function(x, y) {
            // we can only hit one thing.  If two things share the same space then only one gets destroyed.
            // First thing destroyed is a mushroom - therefore if a centipede is falling straight down then it will
            // still get nearer the bottom
            var collisionScore = 0;

            var mushroomHit = GameBoard.checkCollision(x, y, true);

            switch (mushroomHit) {
                case BoardLocationEnum.Mushroom:
                    collisionScore = GlobalSettings.scoreHitMushroom;
                    break;

                case BoardLocationEnum.PoisonMushroom:
                    collisionScore = GlobalSettings.scoreHitPoisonMushroom;
                    break;
            }

            if (!collisionScore && this.flea && this.flea.checkCollision(x, y)) {
                this.flea = null;
                collisionScore = GlobalSettings.scoreHitFlea;
            }

            if (!collisionScore && this.spider && this.spider.checkCollision(x, y)) {
                this.spider = null;
                collisionScore = GlobalSettings.scoreHitSpider;
            }

            if (!collisionScore && this.snail && this.snail.checkCollision(x, y)) {
                this.snail = null;
                collisionScore = GlobalSettings.scoreHitSnail;
            }

            if (!collisionScore) {
                for (var i = 0; i < this.centipedes.length; i++) {
                    if (this.centipedes[i].checkCollision(x, y, true)) {
                        GameBoard.createMushroom(x, y);
                        collisionScore = GlobalSettings.scoreHitCentipede;
                        break;
                    }
                }
            }

            if (collisionScore) {
                this.incrementScore(x, y, collisionScore);
            }

            return collisionScore;
        },

        incrementScore: function(x, y, increment) {
            this.gameState.Score += increment;
            this.scoreMarkers.push(new ScoreMarker(x, y, increment));
        },

        drawBoard: function() {
            GraphicsEngine.fillRectangle(0, 0, this.gameBoardSize.width, this.gameBoardSize.height, 'black');
            GameBoard.draw();
        },

        drawPlayer: function(animation) {
            var playerData = this.player.calculateAnimation(animation);
            GraphicsEngine.drawImage(playerData.x, playerData.y, playerData.image);
        },

        drawScoreMarkers: function() {
            for (var i = 0; i < this.scoreMarkers.length; i++) {
                var scoreMarkerData = this.scoreMarkers[i].calculateAnimation();
                GraphicsEngine.drawText(scoreMarkerData.x, scoreMarkerData.y, scoreMarkerData.text, scoreMarkerData.colour);
            }
        },

        drawBullets: function() {
            for (var i = 0; i < this.bullets.length; i++) {
                var bulletData = this.bullets[i].calculateAnimation();
                GraphicsEngine.drawImage(bulletData.x, bulletData.y, bulletData.image);
            }
        },

        drawCentipedes: function(animation) {
            for (var i in this.centipedes) {
                var centipedeData = this.centipedes[i].calculateAnimation(animation);

                for (var c in centipedeData) {
                    GraphicsEngine.drawImage(centipedeData[c].x, centipedeData[c].y, centipedeData[c].image);
                }
            }
        },

        drawFlea: function(animation) {
            if (this.flea) {
                var fleaData = this.flea.calculateAnimation(animation);
                GraphicsEngine.drawImage(fleaData.x, fleaData.y, fleaData.image);
            }
        },

        drawSpider: function(animation) {
            if (this.spider) {
                var spiderData = this.spider.calculateAnimation(animation);
                GraphicsEngine.drawImage(spiderData[0].x, spiderData[0].y, spiderData[0].image);
                GraphicsEngine.drawImage(spiderData[1].x, spiderData[1].y, spiderData[1].image);
            }
        },

        drawSnail: function(animation) {
            if (this.snail) {
                var snailData = this.snail.calculateAnimation(animation);
                GraphicsEngine.drawImage(snailData[0].x, snailData[0].y, snailData[0].image);
                GraphicsEngine.drawImage(snailData[1].x, snailData[1].y, snailData[1].image);
            }
        },

        movePlayer: function(animation) {
            if (animation % 2 !== 0) {
                return;
            }

            var playerMove = KeyPressHandler.getNextMovement();

            if (playerMove.direction != DirectionEnum.None && !GameBoard.playerAllowedToMove(this.player.x, this.player.y, playerMove.direction)) {
                playerMove.direction = DirectionEnum.None;
            }

            this.player.move(playerMove.direction, playerMove.isFiring);
        },

        moveScoreMarkers: function(animation) {
            if (this.scoreMarkers.length === 0){
                return;
            }

            for (var i = this.scoreMarkers.length - 1; i >= 0 ; i--) {
                var score = this.scoreMarkers[i];
                if (score.characterState === CharacterState.Dead) {
                    this.scoreMarkers.splice(i, 1);
                } else {
                    score.move(animation);
                }
            }
        },

        moveCentipedes: function(animation) {
            for (var i = this.centipedes.length - 1; i >= 0; i--) {
                var centipede = this.centipedes[i];
                if (centipede.characterState === CharacterState.Dead) {
                    this.centipedes.splice(i, 1);
                    continue;
                }
                this.centipedes[i].move(animation, this.centipedeFramesPerMove);
            }

            // now check if we should add a new centipede in
            if (this.centipedes.length > 0) {
                var firstCentipede = this.centipedes[0];
                if (firstCentipede.y === this.gameBoardSize.height - 1 &&
                    (firstCentipede.x === this.gameBoardSize.width - 1 || firstCentipede.x === 0)) {

                    var me = this;

                    this.centipedes.push(new Centipede(
                        0,
                        (this.gameBoardSize.height - GlobalSettings.playerAreaHeight) + 1,
                        0,
                        (this.gameBoardSize.height - GlobalSettings.playerAreaHeight) + 1,
                        this.gameBoardSize.height - 1,
                        0,
                        this.gameBoardSize.width - 1,
                        this.centipedeFramesPerMove,
                        DirectionEnum.Down,
                        DirectionEnum.Right,
                        this.gameBoardCollisionCheck,
                        function(centipede) { me.generateNewCentipede(centipede)}
                    ));
                }
            }
        },

        moveBullets: function() {
            var activeBullets = [];
            for (var i = 0; i < this.bullets.length; i++) {
                var bullet = this.bullets[i];

                bullet.move();

                if (bullet.bulletState !== CharacterState.Dead) {
                    activeBullets.push(bullet)
                }
            }

            this.bullets = activeBullets;
        },

        moveSpider: function(animation) {
            if (this.spider) {
                if (this.spider.x < -1 || this.spider.x >= GameBoard.width) {
                    this.spider = null;
                } else {
                    this.spider.move(animation);
                }
            }
        },

        moveSnail: function(animation) {
            if (this.snail) {
                if (this.snail.x >= GameBoard.width) {
                    this.snail = null;
                } else {
                    this.snail.move(animation);
                }
            }
        },

        moveFlea: function(animation) {
            if (this.flea) {
                if (this.flea.y >= GameBoard.height) {
                    this.flea = null;
                } else {
                    this.flea.move(animation);
                }
            }
        },

        checkCreateSnail: function() {
            if (this.snail !== undefined && this.snail !== null) {
                return;
            }

            if (Utils.random(GlobalSettings.snailCreationChance) === 0) {
                var y = Utils.random(GameBoard.height - GlobalSettings.playerAreaHeight);

                this.snail = new Snail(y, this.onSnailMoved);
            }
        },

        checkCreateSpider: function() {
            if (this.spider !== undefined && this.spider !== null) {
                return;
            }

            if (Utils.random(GlobalSettings.spiderCreationChance) === 0) {
                var x = this.player.x > (GameBoard.width / 2) ? 0 : GameBoard.width - 1;
                var y = (GameBoard.height - GlobalSettings.playerAreaHeight) + Utils.random(GlobalSettings.playerAreaHeight);

                this.spider = new Spider(x, y, GameBoard.height -1, (GameBoard.height - GlobalSettings.playerAreaHeight) + 1, this.onSpiderMoved);
            }
        },

        checkCreateFlea: function() {
            if (this.flea !== undefined && this.flea !== null) {
                return;
            }

            if (GameBoard.mushroomsInPlayerArea > GlobalSettings.minMushroomsInPlayerAreaBeforeFleaCreated &&
                GameBoard.mushroomsOnScreen > GlobalSettings.minMushroomsBeforeFleaCreated) {
                return;
            }

            if (Utils.random(GlobalSettings.fleaCreationChance) === 0) {
                var x = Utils.random(GameBoard.width);
                this.flea = new Flea(x, this.onFleaMoved);
            }
        },

        gameBoardCollisionCheck: function(x, y) {
            return GameBoard.checkCollision(x, y, false);
        },

        generateNewCentipede: function(newCentipede) {
            this.centipedes.push(newCentipede);
        },

        onFleaMoved: function(x, prevY) {
            if (prevY < GameBoard.height - 1) {
                // Not allowed to put a mushroom on the bottom row
                if (Math.floor(Math.random() * 3) === 0) {
                    GameBoard.createMushroom(x, prevY);
                }
            }
        },

        onSpiderMoved: function(prevX, prevY, x, y) {
            if (x >= 0 && x < GameBoard.width) {
                GameBoard.destroyMushroom(x, y);

                if (x >= 0 && x < GameBoard.width - 1) {
                    GameBoard.destroyMushroom(x + 1, y);
                }
            }
        },

        onSnailMoved: function(prevX, x, y) {
            if (x < GameBoard.width) {
                GameBoard.poisonMushroom(x, y);
            }
        }
    }
});
