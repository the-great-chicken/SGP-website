#> sgp.kits:collection/example/items

give @s trident[ \
    custom_name={text:"Test trident", color:aqua, italic:false}, \
    lore=[[{text:"Nested "}, {text:"lore", bold:true}]], \
    custom_data={enabled:true, level:3} \
    ] 17

item replace entity @s armor.feet with leather_boots[ \
    dyed_color=16711935, \
    enchantments={protection:2}, \
    tooltip_display={hidden_components:["enchantments"]} \
    ]

