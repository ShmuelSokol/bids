-- dbo.a_ship_out_line_2_view



/* view a_ship_out_line_2_view: add view */


/* view a_ship_out_line_2_view: add view */


/* view a_ship_out_line_2_view: add view */

/* view a_ship_out_line_2_view: add view */


/* view a_ship_out_line_2_view: add view */


/* view a_ship_out_line_2_view: add view */


/* view a_ship_out_line_2_view: add view */


/* view a_ship_out_line_2_view: add view */


/* view a_ship_out_line_2_view: add view */
CREATE VIEW [dbo].[a_ship_out_line_2_view]
AS
SELECT        idnK93_RCV AS idnK93_k93, ship_out_line_1_view.*
FROM            ship_out_line_1_view
WHERE        idnK93_RCV > 0
UNION
SELECT        idnK93_imp AS idnK93_k93, ship_out_line_1_view.*
FROM            ship_out_line_1_view
WHERE        idnK93_imp > 0
UNION
SELECT        idnK93_mad AS idnK93_k93, ship_out_line_1_view.*
FROM            ship_out_line_1_view
WHERE        idnK93_mad > 0









