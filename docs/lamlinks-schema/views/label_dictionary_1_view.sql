-- dbo.label_dictionary_1_view



/* view label_dictionary_1_view: add view */


/* view label_dictionary_1_view: add view */


/* view label_dictionary_1_view: add view */

/* view label_dictionary_1_view: add view */


/* view label_dictionary_1_view: add view */


/* view label_dictionary_1_view: add view */


/* view label_dictionary_1_view: add view */


/* view label_dictionary_1_view: add view */


/* view label_dictionary_1_view: add view */


/* view label_dictionary_1_view: add view */


/* view label_dictionary_1_view: add view */


/* view label_dictionary_1_view: add view */


/* view label_dictionary_1_view: add view */


/* view label_dictionary_1_view: add view */


/* view label_dictionary_1_view: add view */


/* view label_dictionary_1_view: add view */


/* view label_dictionary_1_view: add view */


/* view label_dictionary_1_view: add view */
CREATE VIEW [dbo].[label_dictionary_1_view]
AS
SELECT     dbo.kbf_tab.*, dbo.kbd_tab.*, dbo.kbd_tab.catset_kbd AS catset_spi, dbo.kbd_tab.caudes_kbd AS caudes_spi, dbo.kap_tab.catitl_kap, dbo.kap_tab.catdes_kap
FROM         dbo.kbf_tab INNER JOIN
                      dbo.kap_tab ON dbo.kbf_tab.pstkap_kbf = dbo.kap_tab.idnkap_kap LEFT OUTER JOIN
                      dbo.kbd_tab ON dbo.kbf_tab.spikbd_kbf = dbo.kbd_tab.idnkbd_kbd


















