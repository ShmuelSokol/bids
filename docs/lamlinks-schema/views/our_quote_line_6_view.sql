-- dbo.our_quote_line_6_view



/* view our_quote_line_6_view: add view */


/* view our_quote_line_6_view: add view */


/* view our_quote_line_6_view: add view */

/* view our_quote_line_6_view: add view */


/* view our_quote_line_6_view: add view */
CREATE VIEW dbo.our_quote_line_6_view
AS
SELECT DISTINCT 
                         dbo.our_quote_line_1_view.idnk34_k34, dbo.our_quote_line_1_view.bidtyp_k34, dbo.our_quote_line_1_view.qrefno_k34, dbo.our_quote_line_1_view.uptime_k34, dbo.our_quote_line_1_view.up_k35, 
                         dbo.our_quote_line_1_view.daro_k35, dbo.our_quote_line_1_view.mcage_k34, dbo.our_quote_line_1_view.pn_k34, dbo.our_quote_line_1_view.upname_k35, dbo.solicitation_identity_1_view.idnk11_k11 AS idnk11_qry, 
                         dbo.our_quote_line_1_view.idnk11_k11 AS idnk11_qte
FROM            dbo.solicitation_identity_1_view INNER JOIN
                         dbo.our_quote_line_1_view ON dbo.solicitation_identity_1_view.idnkc4_kc4 = dbo.our_quote_line_1_view.idnkc4_kc4





