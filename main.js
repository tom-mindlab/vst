import './visual-search.less'
import { screen, utils, controls} from 'wombat'
import template from './visual-search.html'
import languages from './lang.json'

var CONFIG,
	ONCOMPLETE,
	IMAGES,
	CURRENT,
	ACTIVE,
	STIMULI = [],
	TOTAL,
	LANG


export default function(config, cb){

	CONFIG = config
	ONCOMPLETE = cb

	// STARTUP THE TEST
	async.series([
		checkStimuli,
		loadLanguage,
		buildStimuli,
		buildUI,
		openIntroduction,
		loadImages,
		closeIntroduction

	], next)

}


function openIntroduction(cb){

	_introScreen
		.find('input')
		.val(LANG["intro_continue_loading_button"])
		.prop( "disabled", true );

	_introScreen.fadeIn('slow', cb)

}


function closeIntroduction(cb){

	_introScreen
		.find('input')
		.val(LANG.intro_continue_button)
		.prop( "disabled", false )
		.click(function(){
			_introScreen.fadeOut('fast', function(){
				_mainScreen.fadeIn('fast', cb)
			})
		})

}


function loadLanguage(cb){
	LANG = utils.buildLanguage(languages, CONFIG)
	if(CONFIG.language_options){
		LANG = _.extend(LANG, CONFIG.language_options)
	}
	cb()	
}


function checkStimuli(cb){

	var stimuli = CONFIG.stimuli

	var uniqueNames = []
	_.each(stimuli, function(s){

		var name = s.name

		if(!s.path) throw alert('Invalid path:' + s.path + ' \nBase.name:' + name)

		if(uniqueNames.indexOf(name)== -1){

			uniqueNames.push(name)

		} else {
			throw alert('Duplicate stimuli name in configuration:' + name)
		}

	})

	cb()

}


function loadImages(cb){
	var stimuli = CONFIG.stimuli

	// Perform the download
	utils.preloadImages(stimuli,function(images){
		IMAGES = images
		cb()
	})
}

function buildStimuli(cb){


	if(!CONFIG.timer_duration) CONFIG.timer_duration = 20000

	STIMULI = _.map(CONFIG.stimuli, function(s){ return s.name })


	if(CONFIG.repeats) STIMULI = utils.repeat(STIMULI, CONFIG.repeats)
	if(CONFIG.sample && CONFIG.sample != -1) STIMULI = utils.sample(STIMULI, CONFIG.sample)
	if(CONFIG.randomise) STIMULI = utils.shuffle(STIMULI)

	TOTAL = STIMULI.length

	cb()

}

var _pauseScreen,
	_pauseContinue,

	_mainScreen,
	_introScreen,

	_imageDisplay,
	_timer,
	_pauseButton,
	_progress,
	_clickOverlay,
	_instruction,
	_currentIdx = 1;


function buildUI(cb){

	// TODO: reroute to lang
	var titleText = 'This is the title'
	var pauseText = 'The test has been paused.'
	var pauseContinueText = 'Continue'


	var ui = $(template).clone()


	_mainScreen = ui.find('.main')
	_pauseScreen = ui.find('.pause-screen')
	_introScreen = ui.find('.introduction')


	// Configure the pause screen
	_pauseScreen.find('.message').html(LANG['pause_message'])
	_pauseScreen.find('input').val(LANG['pause_continue_button'])
	_pauseContinue = _pauseScreen.find('input')


	// Configure the introduction screen
	_introScreen = ui.find('.introduction')
	_introScreen.find('.message').html(LANG.intro_message)
	_introScreen.find('input').val(LANG.intro_continue_button)


	// Get references and init controls
	_imageDisplay = controls.display(ui.find('.stimuli'))
	_timer        = controls.timer(ui.find('.timer'))
	_progress     = controls.progress(ui.find('.progress'))
	_pauseButton =  controls.pause(ui.find('.pause-button'))

	_pauseButton.click(showPauseScreen)

	_instruction = _mainScreen.find('.instruction')


	// plain jquery element
	_clickOverlay = ui
		.find('.click-overlay')
		.click(makeSelection)

	// Configuration the UI appearence
	_mainScreen
		.find('.title')
		.html(LANG['title'])

	_progress.setTotal(STIMULI.length)
	_progress.update(1)

	// Configure the controls
	_timer.duration(CONFIG.timer_duration)
	_timer.timeout(outOfTime)

	_pauseScreen.hide()
	_introScreen.hide()
	_mainScreen.hide()

	screen.enter(ui,'fade', cb)


}


/*
	Screen messages
*/
function showPauseScreen(cb){

	function exitPauseScreen(){
		_pauseScreen.fadeOut('slow', function(){
			_pauseContinue.off()
			_mainScreen.fadeIn('slow', next)
		})
	}

	_mainScreen.fadeOut('slow', function(){
		_timer.reset()
		_pauseScreen.fadeIn('slow', function(){
			_pauseContinue.click(exitPauseScreen)
		})
	})
}


function outOfTime(){
	ACTIVE = false
	STIMULI.push(CURRENT)

	_timer.reset()
	utils.delay(1000, next)
}

var DATA = []

function makeSelection(evt){
	// only works if active
	if(ACTIVE){


		_timer.stop()
		ACTIVE = false
		_currentIdx ++

		var pos = _imageDisplay.getEventPositionOnImage(evt)
		
		// For now we shall just set the selection to 
		// correct if any of the elements clicked is corrent
		var currentImage = IMAGES[CURRENT]



		var correct;
		var clickedTarget;
		currentImage.targets.forEach(function(target){

			var rect = target.rectangle

			var targetClicked = 
				rect.x1 < pos.x &&
				rect.x2 > pos.x &&
				rect.y1 < pos.y &&
				rect.y2 > pos.y

			correct = correct || targetClicked

			if(targetClicked) clickedTarget = target.name

		})

		DATA.push({

			name : CURRENT,
			latency : _timer.value(),
			target : clickedTarget,
			correct : correct,
			x_position : pos.x,
			y_position : pos.y
			
		})
		animateClick(evt, correct)

		if(!correct) STIMULI.push(CURRENT)

		_timer.reset()
		utils.delay(1000, next)

	}
}


function animateClick(evt, correct){


	var clickBlob = $('<div></div>')
		.addClass(correct ? 'circle-correct' : 'circle-incorrect')
		.css({
			left: evt.pageX + 'px',
			top: evt.pageY + 'px'
		})


	$('body')
		.append(clickBlob)

			
	utils.delay(1000, function(){
		clickBlob.remove()
	})
}

function finish(){
	screen.exit('fade', function(){

		var meta = {}
		ONCOMPLETE(meta, DATA)

	})
}

function next(){

	// Start hidden
	_imageDisplay.hide()

	if(STIMULI.length==0) return finish()

	CURRENT = STIMULI.shift()

	_progress.update(TOTAL - STIMULI.length)

	var currentImage = IMAGES[CURRENT].img
	if(IMAGES[CURRENT].instruction){
		_instruction.html(IMAGES[CURRENT].instruction)
		_instruction.show()
	} else {
		_instruction.hide()
	}

	// Set the display elements to show the image
	_imageDisplay.set(currentImage)


	// Variables - move to config
	ACTIVE = true
	
	utils.delay(CONFIG.delay || 3000, function(){
		_timer.start()
		_imageDisplay.show()

	})

}

