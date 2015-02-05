
cc.dist = function(a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
}

cc.radiansBetweenPoints = function(a, b) {
    return Math.atan2(a.y - b.y, b.x - a.x);
}

cc.pointAtCircle = function(origin, radius, angle) {
    return cc.p(origin.x + Math.cos(angle) * radius, origin.y - Math.sin(angle) * radius);
}

var Tank = cc.Sprite.extend({
    ctor: function(color, uid) {
        this._super();

        var animationName = "Tank" + color;
        var frameName = animationName + "0001.png"
        this.initWithSpriteFrameName(frameName);

        this._animation = cc.animate(cc.animationCache.getAnimation(animationName));

        this._uid = uid;
        this._state = "idle";
    },

    getUid: function() {
        return this._uid;
    },

    start: function() {
        this.stop();
        this._movingAction = this.runAction(new cc.RepeatForever(this._animation));
    },

    stop: function() {
        if (this._movingAction) {
            this.stopAction(this._movingAction);
            this._movingAction = null;
        }
    },

    move: function(message) {
        this.start();
        this._begin = cc.p(message.x, message.y);
        this._dest = cc.p(message.destx, message.desty);
        this._dist = this._movelen = message.dist;
        this._destr = message.destr;
        this._dir = message.dir;
        this._speed = message.speed;
        this._rotateSpeed = message.rotateSpeed;
        this._rotateOffset = message.rotateOffset;
        this._state = this._rotateOffset > 0 ? "rotate" : "move";

        this.setPosition(message.x, message.y);
        this.setRotation(message.rotation);
    },

    step: function(dt) {
        if (this._state == "idle") return;

        if (this._state == "rotate") {
            var rotation = this.getRotation();
            var offset = this._rotateSpeed * dt;
            if (this._dir == "right") {
                rotation += offset;
            } else {
                rotation -= offset;
            }
            this._rotateOffset -= offset;
            if (this._rotateOffset <= 0) {
                rotation = this._destr;
                this._state = "move";
            }
            this.setRotation(rotation);
        } else if (this._state == "move") {
            var radians = cc.degreesToRadians(this.getRotation());
            var pos = this.getPosition();
            var offset = this._speed * dt;
            this._dist -= offset;
            if (this._dist <= 0) {
                this._state = "idle";
                pos = cc.pointAtCircle(this._begin, this._movelen, radians);
                this.stop();
            } else {
                pos = cc.pointAtCircle(pos, offset, radians);
            }
            this.setPosition(pos);
        }
    }
})


var BattleLayer = cc.Layer.extend({
    ctor: function() {
        this._super();

        var bg = new cc.LayerColor(cc.color(0x53, 0x47, 0x41, 255));
        this.addChild(bg);

        this._tanks = {};

        var self = this;

        server.onenter = function(message) {
            server.onidle(message);
        };

        server.onidle = function(message) {
            var tank = self.checktank(message);
            tank.setVisible(true);
            tank.setPosition(message.x, message.y);
            tank.setRotation(message.rotation);
        };

        server.onmove = function(message) {
            var tank = self.checktank(message);
            if (typeof tank !== "undefined") {
                tank.move(message);
            }
        }

        server.onremove = function(message) {
            var tank = self.checktank(message);
            if (typeof tank !== "undefined") {
                tank.removeFromParent();
                self._tanks[tank.getUid()] = null;
            }
        }

        server.sendSocketMessage("battle.enter");

        var listener = cc.EventListener.create({
            event: cc.EventListener.TOUCH_ONE_BY_ONE,
            swallowTouches: true,
            onTouchBegan: function (touch, event) {
                self.move(touch.getLocation());
                return false;
            }
        });

        cc.eventManager.addListener(listener, this);
        this.scheduleUpdate();
    },

    checktank: function(message) {
        var currentUid = server.getUid();
        var uid = message.__uid;
        var tank = this._tanks[uid];
        if (typeof tank === "undefined") {
            tank = new Tank(message.color, uid);
            this.addChild(tank);
            if (currentUid == uid) {
                cc.log("your tank %s enter battle", uid);
                this._tank = tank;
            } else {
                cc.log("tank %s enter battle", uid);
            }
        }
        this._tanks[uid] = tank;
        return tank;
    },

    move: function(dest) {
        var tank = this._tank;
        if (tank && tank.isVisible()) {
            var pos = tank.getPosition();
            var data = {
                x: pos.x,
                y: pos.y,
                rotation: tank.getRotation(),
                destx: dest.x,
                desty: dest.y
            };
            server.sendSocketMessage("battle.move", data);
        }
    },

    update: function(dt) {
        var tanks = this._tanks;
        for (uid in tanks) {
            var tank = tanks[uid];
            if (tank && tank.step) {
                tank.step(dt);
            }
        }
    }
});

var BattleScene = cc.Scene.extend({
    onEnter: function() {
        this._super();
        var layer = new BattleLayer();
        this.addChild(layer);
    }
})
