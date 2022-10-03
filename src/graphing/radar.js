const d3 = require('d3')
const d3tip = require('d3-tip')
const Chance = require('chance')
const _ = require('lodash/core')

const RingCalculator = require('../util/ringCalculator')
const QueryParams = require('../util/queryParamProcessor')
const AutoComplete = require('../util/autoComplete')
const config = require('../config')

const MIN_BLIP_WIDTH = 12
const ANIMATION_DURATION = 1000

const Radar = function (size, radar) {
  var svg, blipHistoryDiv, radarElement, quadrantButtons, buttonsGroup, header, alternativeDiv

  var tip = d3tip()
    .attr('class', 'd3-tip')
    .html(function (text) {
      return text
    })

  tip.direction(function () {
    if (d3.select('.quadrant-table.selected').node()) {
      var selectedQuadrant = d3.select('.quadrant-table.selected')
      if (selectedQuadrant.classed('first') || selectedQuadrant.classed('fourth')) {
        return 'n' // was 'ne'
      } else {
        return 'n' // was 'nw'
      }
    }
    return 'n'
  })

  var ringCalculator = new RingCalculator(radar.rings().length, center())

  var self = {}
  var chance

  function center() {
    return Math.round(size / 2)
  }

  function toRadian(angleInDegrees) {
    return (Math.PI * angleInDegrees) / 180
  }

  function plotLines(quadrantGroup, quadrant) {
    var startX = size * (1 - (-Math.sin(toRadian(quadrant.startAngle)) + 1) / 2)
    var endX = size * (1 - (-Math.sin(toRadian(quadrant.startAngle - 90)) + 1) / 2)

    var startY = size * (1 - (Math.cos(toRadian(quadrant.startAngle)) + 1) / 2)
    var endY = size * (1 - (Math.cos(toRadian(quadrant.startAngle - 90)) + 1) / 2)

    if (startY > endY) {
      var aux = endY
      endY = startY
      startY = aux
    }

    quadrantGroup
      .append('line')
      .attr('x1', center())
      .attr('x2', center())
      .attr('y1', startY - 2)
      .attr('y2', endY + 2)
      .attr('stroke-width', 10)

    quadrantGroup
      .append('line')
      .attr('x1', endX)
      .attr('y1', center())
      .attr('x2', startX)
      .attr('y2', center())
      .attr('stroke-width', 10)
  }

  function plotQuadrant(rings, quadrant) {
    var quadrantGroup = svg
      .append('g')
      .attr('class', 'quadrant-group quadrant-group-' + quadrant.order)
      .on('mouseover', mouseoverQuadrant.bind({}, quadrant.order))
      .on('mouseout', mouseoutQuadrant.bind({}, quadrant.order))
      .on('click', selectQuadrant.bind({}, quadrant.order, quadrant.startAngle))

    rings.forEach(function (ring, i) {
      var arc = d3
        .arc()
        .innerRadius(ringCalculator.getRadius(i))
        .outerRadius(ringCalculator.getRadius(i + 1))
        .startAngle(toRadian(quadrant.startAngle))
        .endAngle(toRadian(quadrant.startAngle - 90))

      quadrantGroup
        .append('path')
        .attr('d', arc)
        .attr('class', 'ring-arc-' + ring.order())
        .attr('transform', 'translate(' + center() + ', ' + center() + ')')
    })

    return quadrantGroup
  }

  function plotTexts(quadrantGroup, rings, quadrant) {
    rings.forEach(function (ring, i) {
      if (quadrant.order === 'first' || quadrant.order === 'fourth') {
        quadrantGroup
          .append('text')
          .attr('class', 'line-text')
          .attr('y', center() + 4)
          .attr('x', center() + (ringCalculator.getRadius(i) + ringCalculator.getRadius(i + 1)) / 2)
          .attr('text-anchor', 'middle')
          .text(ring.name())
      } else {
        quadrantGroup
          .append('text')
          .attr('class', 'line-text')
          .attr('y', center() + 4)
          .attr('x', center() - (ringCalculator.getRadius(i) + ringCalculator.getRadius(i + 1)) / 2)
          .attr('text-anchor', 'middle')
          .text(ring.name())
      }
    })
  }

  function circleNew(blip, x, y, order, group) {
    return group
      .append('circle')
      .attr(
        'r',
        blip.width * 7/11 * 1.45
      )
      .attr(
        'transform',
        'scale(' +
          blip.width / 80 +
          ') translate(' +
          (21 + x * (80 / blip.width) - 17) +
          ', ' +
          (16 + y * (80 / blip.width) - 17) +
          ')',
      )
      .attr('stroke-width', 0)
      .attr('class', order),
    group
      .append('circle')
      .attr(
        'r',
        blip.width * 10/11 * 1.45
      )
      .attr(
        'transform',
        'scale(' +
          blip.width / 80 +
          ') translate(' +
          (21 + x * (80 / blip.width) - 17) +
          ', ' +
          (16 + y * (80 / blip.width) - 17) +
          ')',
      )
      .attr('fill-opacity', 0)
      .attr('stroke-width', blip.width * 2/11 * 1.45)
      
      .attr('class', order)
  }

  function circleNewLegend(x, y, group) {
    //group = group.append('g')
    return group
      .append('circle')
      .attr(
        'r',
        6.5
      )
      .attr(
        'transform',
        'scale(' + 22 / 32 + ') translate(' + (18 + x * (32 / 22) - 17) + ', ' + (17 + y * (32 / 22) - 17) + ')',
      ),
      group
      .append('circle')
      .attr(
        'r',
        9.5
      )
      .attr(
        'transform',
        'scale(' + 22 / 32 + ') translate(' + (18 + x * (32 / 22) - 17) + ', ' + (17 + y * (32 / 22) - 17) + ')',
      )
      .attr('fill-opacity', 0)
      .attr('stroke', 'black').attr('stroke-width', 2)
  }

  function circle(blip, x, y, order, group) {
    return (group || svg)
      .append('circle')
      .attr(
        'r',
        blip.width * 7/11 * 1.45
      )
      .attr(
        'transform',
        'scale(' +
          blip.width / 80 +
          ') translate(' +
          (21 + x * (80 / blip.width) - 17) +
          ', ' +
          (16 + y * (80 / blip.width) - 17) +
          ')',
      )
      .attr('stroke-width', 0)
      .attr('class', order)
  }

  function circleLegend(x, y, group) {
    return (group || svg)
      .append('circle')
      .attr(
        'r',
        6.5
      )
      .attr(
        'transform',
        'scale(' + 22 / 32 + ') translate(' + (18 + x * (32 / 22) - 17) + ', ' + (17 + y * (32 / 22) - 17) + ')',
      )
  }

  function triangleUp(blip, x, y, order, group) {
    return (group || svg)
      .append('path')
      .attr(
        'd',
        'M -11,5 11,5 0,-13 z',
      )
      .attr(
        'transform',
        'scale(' +
          blip.width / 18 +
          ') translate(' +
          (18 + x * (18 / blip.width) - 17) +
          ', ' +
          (19 + y * (18/ blip.width) - 17) +
          ')',
      )
      .attr('class', order)
  }

  function triangleUpLegend(x, y, group) {
    return group
      .append('path')
      .attr(
        'd',
        'M -11,5 11,5 0,-13 z',
      )
      .attr(
        'transform',
        'scale(' + 22 / 32 + ') translate(' + (18 + x * (32 / 22) - 17) + ', ' + (20 + y * (32 / 22) - 17) + ')',
      )
  }

  function triangleDown(blip, x, y, order, group) {
    return (group || svg)
      .append('path')
      .attr(
        'd',
        'M -11,-5 11,-5 0,13 z',
      )
      .attr(
        'transform',
        'scale(' +
          blip.width / 18 +
          ') translate(' +
          (17.5 + x * (18 / blip.width) - 17) +
          ', ' +
          (15 + y * (18 / blip.width) - 17) +
          ')',
      )
      .attr('class', order)
    }

    function triangleDownLegend(x, y, group) {
      return group
        .append('path')
        .attr(
          'd',
          'M -11,-5 11,-5 0,13 z',
        )
        .attr(
          'transform',
          'scale(' + 22 / 32 + ') translate(' + (18 + x * (32 / 22) - 17) + ', ' + (12 + y * (32 / 22) - 17) + ')',
        )
    }

    function NewStoryLogo(x, y, scale, group) {
      return group
        .append('path')
        .attr(
          'd',
          'M20.128,9.1699 C15.854,9.1699 12.357,11.0349 9.792,14.0659 L9.792,10.1799 L3.55271368e-15,10.1799 L3.55271368e-15,50.2019 L10.258,50.2019 L10.258,26.8109 C10.258,22.3029 13.444,18.8839 18.03,18.8839 C24.791,18.8839 25.49,24.4799 25.49,26.8109 L25.49,50.2019 L35.748,50.2019 L35.748,26.8109 C35.748,16.2409 29.531,9.1699 20.128,9.1699',
        ),
        group
        .append('path')
        .attr(
          'd',
          'M51.1705,25.7998 C52.6475,21.1378 56.3775,18.1848 61.0405,18.1848 C65.9365,18.1848 69.8215,21.1378 71.0655,25.7998 L51.1705,25.7998 Z M61.1175,9.1698 C49.8495,9.1698 40.6015,18.6508 40.6015,30.2298 C40.6015,41.8098 49.8495,51.1348 61.1175,51.1348 C71.0655,51.1348 78.1365,45.6168 80.4685,37.4568 L69.5105,37.4568 C67.8005,40.6438 64.4595,42.1198 61.0405,42.1198 C56.2215,42.1198 52.3365,39.0888 51.0155,34.1938 L81.2455,34.1938 C82.7215,18.3398 72.9305,9.1698 61.1175,9.1698 L61.1175,9.1698 Z',
        ),
        group
        .append('polygon')
        .attr(
          'points',
          '124.9693 38.1562 117.6643 10.1792 107.4063 10.1792 100.1013 38.1562 93.1073 10.1792 82.2273 10.1792 94.6613 50.2022 105.3083 50.2022 112.5353 23.7022 119.7623 50.2022 130.3313 50.2022 142.8433 10.1792 131.9633 10.1792',
        ),
        group
        .append('polygon')
        .attr(
          'points',
          '147.0767 23.5498 159.2247 29.6898 147.0767 35.8858 147.0767 45.0408 167.2787 33.8958 167.2787 25.5398 147.0767 14.3308',
        ),
        group
        .append('path')
        .attr(
          'd',
          'M190.6353,25.1006 C185.6613,24.3236 182.7083,23.6236 182.7083,21.5266 C182.7083,20.0496 184.6513,18.3396 189.3913,18.3396 C193.1993,18.3396 195.4533,19.8166 196.0753,21.6816 L206.7213,21.6816 C205.4003,14.1436 198.5623,9.1696 189.3913,9.1696 C177.8123,9.1696 172.2953,15.6976 172.2953,21.9926 C172.2953,30.9296 181.8533,32.8716 189.0033,33.9596 C195.9973,35.0476 197.3963,35.9806 197.3963,38.2346 C197.3963,40.5656 194.2873,41.8096 190.1693,41.8096 C187.1383,41.8096 183.0193,40.5656 181.6203,37.1466 L171.2073,37.1466 C172.4503,45.7726 179.9893,51.1346 190.1693,51.1346 C200.4273,51.1346 207.7313,45.5386 207.7313,37.6126 C207.7313,28.9096 200.5823,26.7326 190.6353,25.1006',
        ),
        group
        .append('path')
        .attr(
          'd',
          'M225.1465,33.416 L225.1465,19.272 L232.3735,19.272 L232.3735,10.18 L225.1465,10.18 L225.1465,-3.55271368e-15 L214.8875,-3.55271368e-15 L214.8875,10.18 L210.0695,10.18 L210.0695,19.272 L214.8875,19.272 L214.8875,33.339 C214.8875,44.296 221.1045,51.368 232.8395,50.124 L232.8395,40.799 C227.7105,41.109 225.1465,39.012 225.1465,33.416',
        ),
        group
        .append('path')
        .attr(
          'd',
          'M256.1446,41.7314 C250.7056,41.7314 246.2756,37.0684 246.2756,30.3074 C246.2756,23.3914 250.7056,18.5734 256.1446,18.5734 C261.5846,18.5734 266.0146,23.3914 266.0146,30.3074 C266.0146,37.0684 261.5846,41.7314 256.1446,41.7314 M256.1446,9.1694 C245.0326,9.1694 236.0176,18.2614 236.0176,30.2294 C236.0176,42.1974 245.0326,51.1344 256.1446,51.1344 C267.2576,51.1344 276.3506,42.1974 276.3506,30.2294 C276.3506,18.2614 267.2576,9.1694 256.1446,9.1694',
        ),
        group
        .append('path')
        .attr(
          'd',
          'M291.6905,14.1435 L291.6905,10.1795 L281.8985,10.1795 L281.8985,50.2025 L292.1575,50.2025 L292.1575,30.5405 C292.1575,27.3545 292.5455,24.0905 294.7215,21.8365 C297.0525,19.3495 300.4725,18.8835 304.5905,19.3495 L304.5905,9.4025 C299.7725,8.6255 294.9555,10.1025 291.6905,14.1435',
        ),
        group
        .append('path')
        .attr(
          'd',
          'M334.1602,10.1797 L334.1602,33.5717 C334.1602,38.0787 330.9742,41.4207 326.3892,41.4207 C319.7062,41.4207 318.9292,35.8257 318.9292,33.5717 L318.9292,10.1797 L308.6712,10.1797 L308.6712,33.5717 C308.6712,44.0627 315.1982,51.1347 324.9902,51.1347 C328.6422,51.1347 331.7512,49.8917 334.1602,47.8707 L334.1602,52.5337 C334.1602,56.2637 332.2182,60.2277 326.6222,60.2277 C323.1252,60.2277 320.4822,58.7507 319.8612,55.7977 L309.2152,55.7977 C310.6132,64.0347 317.8412,69.7857 326.6222,69.7857 C337.3472,69.7857 344.4192,62.6367 344.4192,51.8337 L344.4192,10.1797 L334.1602,10.1797 Z',
        ),
        group
        .attr(
          'transform',
          'scale(' + scale + ') translate(' + x + ', ' + y + ')',
        )
    }

  function addRing(ring, order) {
    var table = d3.select('.quadrant-table.' + order)
    table.append('h3').text(ring)
    return table.append('ul')
  }

  function calculateBlipCoordinates(blip, chance, minRadius, maxRadius, startAngle) {
    var adjustX = Math.sin(toRadian(startAngle)) - Math.cos(toRadian(startAngle))
    var adjustY = -Math.cos(toRadian(startAngle)) - Math.sin(toRadian(startAngle))

    var radius = chance.floating({
      min: minRadius + blip.width / 2,
      max: maxRadius - blip.width / 2,
    })
    var angleDelta = (Math.asin(blip.width / 2 / radius) * 180) / (Math.PI - 1.25)
    angleDelta = angleDelta > 45 ? 45 : angleDelta
    var angle = toRadian(chance.integer({ min: angleDelta, max: 90 - angleDelta }))

    var x = center() + radius * Math.cos(angle) * adjustX 
    var y = center() + radius * Math.sin(angle) * adjustY

    return [x, y]
  }

  function thereIsCollision(blip, coordinates, allCoordinates) {
    return allCoordinates.some(function (currentCoordinates) {
      return (
        Math.abs(currentCoordinates[0] - coordinates[0]) < blip.width &&
        Math.abs(currentCoordinates[1] - coordinates[1]) < blip.width
      )
    })
  }

  function plotBlips(quadrantGroup, rings, quadrantWrapper) {
    var blips, quadrant, startAngle, order

    quadrant = quadrantWrapper.quadrant
    startAngle = quadrantWrapper.startAngle
    order = quadrantWrapper.order

    d3.select('.quadrant-table.' + order)
      .append('h2')
      .attr('class', 'quadrant-table__name')
      .text(quadrant.name())

    blips = quadrant.blips()
    rings.forEach(function (ring, i) {
      var ringBlips = blips.filter(function (blip) {
        return blip.ring() === ring
      })

      if (ringBlips.length === 0) {
        return
      }

      var maxRadius, minRadius

      minRadius = ringCalculator.getRadius(i)
      maxRadius = ringCalculator.getRadius(i + 1)

      var sumRing = ring
        .name()
        .split('')
        .reduce(function (p, c) {
          return p + c.charCodeAt(0)
        }, 0)
      var sumQuadrant = quadrant
        .name()
        .split('')
        .reduce(function (p, c) {
          return p + c.charCodeAt(0)
        }, 0)
      chance = new Chance(Math.PI * sumRing * ring.name().length * sumQuadrant * quadrant.name().length)

      var ringList = addRing(ring.name(), order)
      var allBlipCoordinatesInRing = []

      ringBlips.forEach(function (blip) {
        const coordinates = findBlipCoordinates(blip, minRadius, maxRadius, startAngle, allBlipCoordinatesInRing)

        allBlipCoordinatesInRing.push(coordinates)
        drawBlipInCoordinates(blip, coordinates, order, quadrantGroup, ringList)
      })
    })
  }

  function findBlipCoordinates(blip, minRadius, maxRadius, startAngle, allBlipCoordinatesInRing) {
    const maxIterations = 200
    var coordinates = calculateBlipCoordinates(blip, chance, minRadius, maxRadius, startAngle)
    var iterationCounter = 0
    var foundAPlace = false

    while (iterationCounter < maxIterations) {
      if (thereIsCollision(blip, coordinates, allBlipCoordinatesInRing)) {
        coordinates = calculateBlipCoordinates(blip, chance, minRadius, maxRadius, startAngle)
      } else {
        foundAPlace = true
        break
      }
      iterationCounter++
    }

    if (!foundAPlace && blip.width > MIN_BLIP_WIDTH) {
      blip.width = blip.width - 1
      return findBlipCoordinates(blip, minRadius, maxRadius, startAngle, allBlipCoordinatesInRing)
    } else {
      return coordinates
    }
  }

  function historyOverlay(open, blip){ // opent of sluit de history weergave
    let posLeft = parseFloat(svg.style('left'))
    let posRight = parseFloat(svg.style('right'))
    
    if(open && blip !== undefined){
      let fullHistory = '<article><h3>' + blip.ring().name().toUpperCase() + '</h3><p>' + blip.description() + '</p></article>'
      for (let i = 0; i < blip.histories().length; i++) {
        fullHistory += '<article><h3>' + blip.histories()[i].ring.toUpperCase() + '</h3><p>' + blip.histories()[i].description + '</p></article>'// new Date(blip.histories()[i].createdAt)
      }

      blipHistoryDiv.classed('expanded', true)
      blipHistoryDiv.style('width', size + 'px')
      blipHistoryDiv.select('section').style('max-height', parseFloat(svg.style('height')) - parseFloat(blipHistoryDiv.select('h2').style('height'))*2 + 'px')
      
      if(posLeft > posRight){
        blipHistoryDiv.style('left', posLeft + parseFloat(svg.style('width')) - size + 'px')
      }
      //blipHistoryDiv.style('left', parseFloat(blipHistoryDiv.style('left')) - size + 'px').style('right', parseFloat(blipHistoryDiv.style('right')) + size + 'px')
      console.log(blip.histories())
      
      blipHistoryDiv.select('h2').html(blip.name() + ' - History')
      blipHistoryDiv.select('section').html(fullHistory)
    }else if(!open){
      blipHistoryDiv.classed('expanded', false)
      blipHistoryDiv.style('width', 0 + 'px')
      blipHistoryDiv.select('section').style('max-height', 0)

      if(posLeft > posRight){
        blipHistoryDiv.style('right', posRight - parseFloat(blipHistoryDiv.style('width')) + 'px')
        blipHistoryDiv.style('left', posLeft + parseFloat(svg.style('width')) + 'px')
      }else{
        blipHistoryDiv.style('left', posLeft - parseFloat(blipHistoryDiv.style('width')) + 'px')
        blipHistoryDiv.style('right', posRight + parseFloat(svg.style('width')) + 'px')
      }
    }
  }

  function drawBlipInCoordinates(blip, coordinates, order, quadrantGroup, ringList) {
    var x = coordinates[0]
    var y = coordinates[1]

    var group = quadrantGroup
      .append('g')
      .attr('class', 'blip-link')
      .attr('id', 'blip-link-' + blip.number())

    if (blip.isNew()) {
      circle(blip, x, y, order, group)
    } else if(blip.movedUp()) { 
      triangleUp(blip, x, y, order, group)
    } else if(blip.movedDown()) { 
      triangleDown(blip, x, y, order, group)
    } else {
      circleNew(blip, x, y, order, group)
    }

    group
      .append('text')
      .attr('x', x)
      .attr('y', y + 4)
      .attr('class', 'blip-text')
      // derive font-size from current blip width
      .style('font-size', (blip.width * 10) / 22 + 'px')
      .attr('text-anchor', 'middle')
      .text(blip.number())

    var blipListItem = ringList.append('li')
    var blipText = blip.number() + '. ' + blip.name() + (blip.topic() ? '. - ' + blip.topic() : '')
    blipListItem
      .append('div')
      .attr('class', 'blip-list-item')
      .attr('id', 'blip-list-item-' + blip.number())
      .text(blipText)

    var blipItemDescription = blipListItem
      .append('div')
      .attr('id', 'blip-description-' + blip.number())
      .attr('class', 'blip-item-description')
      
    if (blip.description()) {
      blipItemDescription
        .append('p').html(blip.description() + "<br>")
        .append('button')
        .attr('class', 'button')
        .html('View History >')
        .style('min-width', '160px')
        .style('margin-top', '10px')
        .style('margin-bottom', '10px')
    }else{
      blipItemDescription
        .append('p')
        .append('button')
        .attr('class', 'button')
        .html('View History >')
        .style('min-width', '160px')
    }
    
    var historyButton = blipItemDescription.select('p button')

    var mouseOver = function () {
      d3.selectAll('g.blip-link').attr('opacity', 0.3)
      group.attr('opacity', 1.0)
      blipListItem.selectAll('.blip-list-item').classed('highlight', true)
      tip.show(blip.name(), group.node())
    }

    var mouseOut = function () {
      d3.selectAll('g.blip-link').attr('opacity', 1.0)
      blipListItem.selectAll('.blip-list-item').classed('highlight', false)
      tip.hide().style('left', 0).style('top', 0)
    }

    blipListItem.on('mouseover', mouseOver).on('mouseout', mouseOut)
    group.on('mouseover', mouseOver).on('mouseout', mouseOut)

    var clickBlip = function () {
      d3.select('.blip-item-description.expanded').node() !== blipItemDescription.node() &&
        d3.select('.blip-item-description.expanded p button').html('View History >') &&
        d3.select('.blip-item-description.expanded').classed('expanded', false)
      blipItemDescription.classed('expanded', !blipItemDescription.classed('expanded'))

      d3.select('.blip-list-item.expanded').node() !== blipListItem.select('.blip-list-item').node() &&
        d3.select('.blip-list-item.expanded').classed('expanded', false)
      blipListItem.select('.blip-list-item').classed('expanded', blipItemDescription.classed('expanded'))

      blipItemDescription.on('click', function (event) {
        event.stopPropagation()
      })

      historyButton.html('View History >')
      historyOverlay(false) // sluit history weergave als een lijst item wordt gesloten of een ander wordt geopend
      historyButton.on('click', function() {
        if(historyButton.html() == 'View History &gt;'){
          historyButton.html('Close History <')
          historyOverlay(true, blip)
        }else{
          historyButton.html('View History >')
          historyOverlay(false)
        }
      })

    }
    blipListItem.on('click', clickBlip)
  }

  function removeHomeLink() {
    d3.select('.home-link').remove()
  }

  function createHomeLink(pageElement) {
    if (pageElement.select('.home-link').empty()) {
      pageElement
        .insert('div', 'div#alternative-buttons')
        .html('&#171; Back to Radar home')
        .classed('home-link', true)
        .classed('selected', true)
        .classed('button', true)
        .on('click', redrawFullRadar)
        .append('g')
        .attr('fill', '#626F87')
        .append('path')
        .attr(
          'd',
          'M27.6904224,13.939279 C27.6904224,13.7179572 27.6039633,13.5456925 27.4314224,13.4230122 L18.9285959,6.85547454 C18.6819796,6.65886965 18.410898,6.65886965 18.115049,6.85547454 L9.90776939,13.4230122 C9.75999592,13.5456925 9.68592041,13.7179572 9.68592041,13.939279 L9.68592041,25.7825947 C9.68592041,25.979501 9.74761224,26.1391059 9.87092041,26.2620876 C9.99415306,26.3851446 10.1419265,26.4467108 10.3145429,26.4467108 L15.1946918,26.4467108 C15.391698,26.4467108 15.5518551,26.3851446 15.6751633,26.2620876 C15.7984714,26.1391059 15.8600878,25.979501 15.8600878,25.7825947 L15.8600878,18.5142424 L21.4794061,18.5142424 L21.4794061,25.7822933 C21.4794061,25.9792749 21.5410224,26.1391059 21.6643306,26.2620876 C21.7876388,26.3851446 21.9477959,26.4467108 22.1448776,26.4467108 L27.024951,26.4467108 C27.2220327,26.4467108 27.3821898,26.3851446 27.505498,26.2620876 C27.6288061,26.1391059 27.6904224,25.9792749 27.6904224,25.7822933 L27.6904224,13.939279 Z M18.4849735,0.0301425662 C21.0234,0.0301425662 23.4202449,0.515814664 25.6755082,1.48753564 C27.9308469,2.45887984 29.8899592,3.77497963 31.5538265,5.43523218 C33.2173918,7.09540937 34.5358755,9.05083299 35.5095796,11.3015031 C36.4829061,13.5518717 36.9699469,15.9439104 36.9699469,18.4774684 C36.9699469,20.1744196 36.748098,21.8101813 36.3044755,23.3844521 C35.860551,24.9584216 35.238498,26.4281731 34.4373347,27.7934053 C33.6362469,29.158336 32.6753041,30.4005112 31.5538265,31.5197047 C30.432349,32.6388982 29.1876388,33.5981853 27.8199224,34.3973401 C26.4519041,35.1968717 24.9791531,35.8176578 23.4016694,36.2606782 C21.8244878,36.7033971 20.1853878,36.9247943 18.4849735,36.9247943 C16.7841816,36.9247943 15.1453837,36.7033971 13.5679755,36.2606782 C11.9904918,35.8176578 10.5180429,35.1968717 9.15002449,34.3973401 C7.78223265,33.5978839 6.53752245,32.6388982 5.41612041,31.5197047 C4.29464286,30.4005112 3.33339796,29.158336 2.53253673,27.7934053 C1.73144898,26.4281731 1.10909388,24.9584216 0.665395918,23.3844521 C0.22184898,21.8101813 0,20.1744196 0,18.4774684 C0,16.7801405 0.22184898,15.1446802 0.665395918,13.5704847 C1.10909388,11.9962138 1.73144898,10.5267637 2.53253673,9.16153157 C3.33339796,7.79652546 4.29464286,6.55435031 5.41612041,5.43523218 C6.53752245,4.3160387 7.78223265,3.35675153 9.15002449,2.55752138 C10.5180429,1.75806517 11.9904918,1.13690224 13.5679755,0.694183299 C15.1453837,0.251464358 16.7841816,0.0301425662 18.4849735,0.0301425662 L18.4849735,0.0301425662 Z',
        )
    }
  }

  function removeRadarLegend() {
    d3.select('.legend').remove()
  }

  function drawLegend(order) {
    removeRadarLegend()

    var circleNewKey = 'New'
    var triangleUpKey = 'Moved Up'
    var triangleDownKey = 'Moved Down'
    var circleKey = 'No change'

    var container = d3
      .select('svg')
      .append('g')
      .attr('class', 'legend legend' + '-' + order)

    var x = 10
    var y = 5

    var clientWidth = document.getElementById('radar-plot').clientWidth
    var logoScale = clientWidth / 100 * 0.03
    var legendScale = 0.2 + clientWidth / 1000 * 0.8

    var logoX = 3334 / 100 * 44.75
    var logoY = 3373 / 100 * 48.5
    
    if (order === 'first') {
      x = (4 * size) / 5
      y = (1 * size) / 5
      logoX = (0 + x * (64 / 22) - 17)
      logoY = (12 + y * (64 / 22) - 17)
      //logoX = 3334 / 100 * 0.8
      //logoY = 3373 / 100 * 95.5
      logoScale = 22 / 64
      legendScale = 1
    }

    if (order === 'second') {
      x = (1 * size) / 5 - 15
      y = (1 * size) / 5 - 20
      logoX = (0 + x * (64 / 22) - 17)
      logoY = (12 + y * (64 / 22) - 17)
      //logoX = 3334 / 100 * 92.45
      //logoY = 3373 / 100 * 95.5
      logoScale = 22 / 64
      legendScale = 1
    }

    if (order === 'third') {
      x = (1 * size) / 5 - 15
      y = (4 * size) / 5 + 15
      logoX = (0 + x * (64 / 22) - 17)
      logoY = (12 + y * (64 / 22) - 17)
      //logoX = 3334 / 100 * 88.8
      //logoY = 3373 / 100 * 2
      logoScale = 22 / 64
      legendScale = 1
    }

    if (order === 'fourth') {
      x = (4 * size) / 5
      y = (4 * size) / 5
      logoX = (0 + x * (64 / 22) - 17)
      logoY = (12 + y * (64 / 22) - 17)
      //logoX = 3334 / 100 * 92.45
      //logoY = 3373 / 100 * 95.5
      logoScale = 22 / 64
      legendScale = 1
    }

    d3.select('.legend')
      .attr('class', 'legend legend-' + order)
      .transition()
      .style('visibility', 'visible')

    label=container.append('g')
    legend=container.append('g')
    legend.attr('transform', 'scale(' + legendScale + ')')
    
    NewStoryLogo(logoX, logoY, logoScale, label)

    circleNewLegend(x, y + 30, legend)

    legend
      .append('text')
      .attr('x', x + 15)
      .attr('y', y + 35)
      .attr('font-size', '0.8em')
      .text(circleNewKey)

    triangleUpLegend(x, y + 50, legend)

    legend
      .append('text')
      .attr('x', x + 15)
      .attr('y', y + 55)
      .attr('font-size', '0.8em')
      .text(triangleUpKey)

    triangleDownLegend(x, y + 70, legend)

    legend
      .append('text')
      .attr('x', x + 15)
      .attr('y', y + 75)
      .attr('font-size', '0.8em')
      .text(triangleDownKey)

    circleLegend(x, y + 90, legend)

    legend
      .append('text')
      .attr('x', x + 15)
      .attr('y', y + 95)
      .attr('font-size', '0.8em')
      .text(circleKey)
  }

  function redrawFullRadar() {
    removeHomeLink()
    historyOverlay(false)
    removeRadarLegend()
    drawLegend()
    tip.hide()
    d3.selectAll('g.blip-link').attr('opacity', 1.0)

    svg.style('left', 0).style('right', 0)

    d3.selectAll('.button').classed('selected', false).classed('full-view', true)

    d3.selectAll('.quadrant-table').classed('selected', false)
    d3.selectAll('.home-link').classed('selected', false)

    d3.selectAll('.quadrant-group').transition().duration(ANIMATION_DURATION).attr('transform', 'scale(1)')

    d3.selectAll('.quadrant-group .blip-link').transition().duration(ANIMATION_DURATION).attr('transform', 'scale(1)')

    d3.selectAll('.quadrant-group').style('pointer-events', 'auto')
  }

  function searchBlip(_e, ui) {
    const { blip, quadrant } = ui.item
    const isQuadrantSelected = d3.select('div.button.' + quadrant.order).classed('selected')
    selectQuadrant.bind({}, quadrant.order, quadrant.startAngle)()
    const selectedDesc = d3.select('#blip-description-' + blip.number())
    d3.select('.blip-item-description.expanded').node() !== selectedDesc.node() &&
      d3.select('.blip-item-description.expanded').classed('expanded', false)
    selectedDesc.classed('expanded', true)

    d3.selectAll('g.blip-link').attr('opacity', 0.3)
    const group = d3.select('#blip-link-' + blip.number())
    group.attr('opacity', 1.0)
    d3.selectAll('.blip-list-item').classed('highlight', false)
    d3.select('#blip-list-item-' + blip.number()).classed('highlight', true)
    if (isQuadrantSelected) {
      tip.show(blip.name(), group.node())
    } else {
      // need to account for the animation time associated with selecting a quadrant
      tip.hide()

      setTimeout(function () {
        tip.show(blip.name(), group.node())
      }, ANIMATION_DURATION)
    }
  }

  function plotRadarHeader() {
    header = d3.select('body').insert('header', '#radar')
    header
      .append('div')
      .attr('class', 'radar-title')
      .append('div')
      .attr('class', 'radar-title__text')
      .append('h1')
      .text(document.title)
      .style('cursor', 'pointer')
      .on('click', redrawFullRadar)

    header
      .select('.radar-title')
      .append('div')
      .attr('class', 'radar-title__logo')
      .html('<a href="https://www.thoughtworks.com"> <img src="/images/logo.png" /> </a>')

    buttonsGroup = header.append('div').classed('buttons-group', true)

    quadrantButtons = buttonsGroup.append('div').classed('quadrant-btn--group', true)

    alternativeDiv = header.append('div').attr('id', 'alternative-buttons')

    return header
  }

  function plotHeader() {
    //document.querySelector('.hero-banner__title-text').innerHTML = "Technology Radar"
    const radarWrapper = d3.select('main .graph-placeholder')
    //document.querySelector('.hero-banner__title-text').addEventListener('click', redrawFullRadar)

    buttonsGroup = radarWrapper.append('div').classed('buttons-group', true)

    quadrantButtons = buttonsGroup.append('div').classed('quadrant-btn--group', true)

    alternativeDiv = radarWrapper.append('div').attr('id', 'alternative-buttons')

    return radarWrapper
  }

  function plotQuadrantButtons(quadrants) {
    function addButton(quadrant) {
      radarElement.append('div').attr('class', 'quadrant-table ' + quadrant.order)

      quadrantButtons
        .append('div')
        .attr('class', 'button ' + quadrant.order + ' full-view')
        .text(quadrant.quadrant.name())
        .on('mouseover', mouseoverQuadrant.bind({}, quadrant.order))
        .on('mouseout', mouseoutQuadrant.bind({}, quadrant.order))
        .on('click', selectQuadrant.bind({}, quadrant.order, quadrant.startAngle))
    }

    _.each([0, 1, 2, 3], function (i) {
      addButton(quadrants[i])
    })
/*
    buttonsGroup
      .append('div')
      .classed('print-radar-btn', true)
      .append('div')
      .classed('print-radar button no-capitalize', true)
      .text('Print this radar')
      .on('click', window.print.bind(window))
*/
    alternativeDiv
      .append('div')
      .classed('search-box', true)
      .append('input')
      .attr('id', 'auto-complete')
      .attr('placeholder', 'Search')
      .classed('search-radar', true)

    AutoComplete('#auto-complete', quadrants, searchBlip)
  }

  function plotRadarFooter() {
    d3.select('body')
      .insert('div', '#radar-plot + *')
      .attr('id', 'footer')
      .append('div')
      .attr('class', 'footer-content')
      .append('p')
      .html(
        'Powered by <a href="https://www.thoughtworks.com"> Thoughtworks</a>. ' +
          'By using this service you agree to <a href="https://www.thoughtworks.com/radar/tos">Thoughtworks\' terms of use</a>. ' +
          'You also agree to our <a href="https://www.thoughtworks.com/privacy-policy">privacy policy</a>, which describes how we will gather, use and protect any personal data contained in your public Google Sheet. ' +
          'This software is <a href="https://github.com/thoughtworks/build-your-own-radar">open source</a> and available for download and self-hosting.',
      )
  }

  function mouseoverQuadrant(order) {
    d3.select('.quadrant-group-' + order).style('opacity', 1)
    d3.selectAll('.quadrant-group:not(.quadrant-group-' + order + ')').style('opacity', 0.3)
  }

  function mouseoutQuadrant(order) {
    d3.selectAll('.quadrant-group:not(.quadrant-group-' + order + ')').style('opacity', 1)
  }

  function selectQuadrant(order, startAngle) {
    d3.selectAll('.home-link').classed('selected', false)
    createHomeLink(d3.select('header'))

    d3.selectAll('.button').classed('selected', false).classed('full-view', false)
    d3.selectAll('.button.' + order).classed('selected', true)
    d3.selectAll('.quadrant-table').classed('selected', false)
    d3.selectAll('.quadrant-table.' + order).classed('selected', true)
    d3.selectAll('.blip-item-description').classed('expanded', false)
    d3.selectAll('.blip-list-item').classed('expanded', false)
    d3.selectAll('.blip-item-description p button').html('View History >')
    historyOverlay(false)
    //blipHistoryDiv.style('display', 'none')

    var clientWidth = document.getElementById('radar-plot').clientWidth
    var scale = 1.95 //+ clientWidth / 1000 * 0.4

    var adjustX = Math.round(Math.sin(toRadian(startAngle)) - Math.cos(toRadian(startAngle)))
    var adjustY = Math.cos(toRadian(startAngle)) + Math.sin(toRadian(startAngle))

    var translateX = ((-1 * (1 + adjustX) * size) / 2) * (scale - 1) + -adjustX * (1 - scale / 2) * size
    var translateY = -1 * (1 - adjustY) * (size / 2 - 7) * (scale - 1) - ((1 - adjustY) / 2) * (1 - scale / 2) * size

    var translateXAll = (((1 - adjustX) / 2) * size * scale) / 2 + ((1 - adjustX) / 2) * (1 - scale / 2) * size
    var translateYAll = (((1 + adjustY) / 2) * size * scale) / 2

    var moveRight = ((1 + adjustX) * (0.8 * window.innerWidth - size)) / 2
    var moveLeft = ((1 - adjustX) * (0.8 * window.innerWidth - size)) / 2

    var blipScale = 3 / 4
    var blipTranslate = (1 - blipScale) / blipScale

    svg.style('left', moveLeft + 'px').style('right', moveRight + 'px')
    blipHistoryDiv.style('width', 0 + 'px').style('height', size + 14 + 'px')
    
    if(moveLeft > moveRight){
      blipHistoryDiv.style('right', moveRight - parseFloat(blipHistoryDiv.style('width')) + 'px')
      blipHistoryDiv.style('left', moveLeft + parseFloat(svg.style('width')) + 'px')
    }else{
      blipHistoryDiv.style('left', moveLeft - parseFloat(blipHistoryDiv.style('width')) + 'px')
      blipHistoryDiv.style('right', moveRight + parseFloat(svg.style('width')) + 'px')
    }

    d3.select('.quadrant-group-' + order)
      .transition()
      .duration(ANIMATION_DURATION)
      .attr('transform', 'translate(' + translateX + ',' + translateY + ')scale(' + scale + ')')
    d3.selectAll('.quadrant-group-' + order + ' .blip-link text').each(function () {
      var x = d3.select(this).attr('x')
      var y = d3.select(this).attr('y')
      d3.select(this.parentNode)
        .transition()
        .duration(ANIMATION_DURATION)
        .attr('transform', 'scale(' + blipScale + ')translate(' + blipTranslate * x + ',' + blipTranslate * y + ')')
    })

    d3.selectAll('.quadrant-group').style('pointer-events', 'auto')

    d3.selectAll('.quadrant-group:not(.quadrant-group-' + order + ')')
      .transition()
      .duration(ANIMATION_DURATION)
      .style('pointer-events', 'none')
      .attr('transform', 'translate(' + translateXAll + ',' + translateYAll + ')scale(0)')

    if (d3.select('.legend.legend-' + order).empty()) {
      drawLegend(order)
    }
  }

  self.init = function () {
    const selector = config.featureToggles.UIRefresh2022 ? 'main' : 'body'
    radarElement = d3.select(selector).append('div').attr('id', 'radar')
    return self
  }

  function constructSheetUrl(sheetName) {
    var noParamUrl = window.location.href.substring(0, window.location.href.indexOf(window.location.search))
    var queryParams = QueryParams(window.location.search.substring(1))
    var sheetUrl = noParamUrl + '?sheetId=' + queryParams.sheetId + '&sheetName=' + encodeURIComponent(sheetName)
    return sheetUrl
  }

  function plotAlternativeRadars(alternatives, currentSheet) {
    var alternativeSheetButton = alternativeDiv.append('div').classed('multiple-sheet-button-group', true)

    alternativeSheetButton.append('p').text('Choose a sheet to populate radar')
    alternatives.forEach(function (alternative) {
      alternativeSheetButton
        .append('div:a')
        .attr('class', 'first full-view alternative multiple-sheet-button')
        .attr('href', constructSheetUrl(alternative))
        .text(alternative)

      if (alternative === currentSheet) {
        d3.selectAll('.alternative')
          .filter(function () {
            return d3.select(this).text() === alternative
          })
          .attr('class', 'highlight multiple-sheet-button')
      }
    })
  }

  self.plot = function () {
    var rings, quadrants, alternatives, currentSheet
    
    rings = radar.rings()
    quadrants = radar.quadrants()
    alternatives = radar.getAlternatives()
    currentSheet = radar.getCurrentSheet()

    if (config.featureToggles.UIRefresh2022) {
      const landingPageElements = document.querySelectorAll('main .home-page')
      landingPageElements.forEach((elem) => {
        elem.style.display = 'none'
      })
      plotHeader()
    } else {
      plotRadarHeader()
      plotRadarFooter()
    }

    if (alternatives.length) {
      plotAlternativeRadars(alternatives, currentSheet)
    }

    plotQuadrantButtons(quadrants)

    radarElement.style('height', size + 14 + 'px')
    svg = radarElement.append('svg').call(tip)
    svg
      .attr('id', 'radar-plot')
      .attr('width', size)
      .attr('height', size + 14)

    blipHistoryDiv = radarElement.append('div')
    blipHistoryDiv
      .attr('id', 'blip-history')
      .style('width', size + 'px')
      .style('height', size + 14 + 'px')
      .append('h2')
    blipHistoryDiv
      .append('section')

    _.each(quadrants, function (quadrant) {
      var quadrantGroup = plotQuadrant(rings, quadrant)
      plotLines(quadrantGroup, quadrant)
      plotTexts(quadrantGroup, rings, quadrant)
      plotBlips(quadrantGroup, rings, quadrant)
    })

    drawLegend()
  }

  return self
}

module.exports = Radar
