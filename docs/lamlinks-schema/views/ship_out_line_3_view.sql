-- dbo.ship_out_line_3_view



/* view ship_out_line_3_view: add view */


/* view ship_out_line_3_view: add view */


/* view ship_out_line_3_view: add view */

/* view ship_out_line_3_view: add view */


/* view ship_out_line_3_view: add view */


/* view ship_out_line_3_view: add view */


/* view ship_out_line_3_view: add view */


/* view ship_out_line_3_view: add view */


/* view ship_out_line_3_view: add view */
CREATE VIEW [dbo].[ship_out_line_3_view]
AS
SELECT        idnK93_RCV AS idnK93_k93,dspqty_ka4, idnka4_ka4, ship_out_line_1_view.*
FROM            ship_out_line_1_view INNER JOIN
                         k93_tab ON idnK93_k93 = idnK93_RCV INNER JOIN
                         ka4_tab ON idnK93_ka4 = idnK93_k93
WHERE        idnK93_RCV > 0
UNION
SELECT        idnK93_imp AS idnK93_k93,dspqty_ka4, idnka4_ka4, ship_out_line_1_view.*
FROM            ship_out_line_1_view INNER JOIN
                         k93_tab ON idnK93_k93 = idnK93_imp INNER JOIN
                         ka4_tab ON idnK93_ka4 = idnK93_k93
WHERE        idnK93_imp > 0
UNION
SELECT        idnK93_mad AS idnK93_k93,dspqty_ka4, idnka4_ka4, ship_out_line_1_view.*
FROM            ship_out_line_1_view INNER JOIN
                         k93_tab ON idnK93_k93 = idnK93_mad INNER JOIN
                         ka4_tab ON idnK93_ka4 = idnK93_k93
WHERE        idnK93_mad > 0









