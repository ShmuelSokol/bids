-- dbo.our_quote_line_5_view



/* view our_quote_line_5_view: add view */


/* view our_quote_line_5_view: add view */


/* view our_quote_line_5_view: add view */

/* view our_quote_line_5_view: add view */


/* view our_quote_line_5_view: add view */


/* view our_quote_line_5_view: add view */


/* view our_quote_line_5_view: add view */
CREATE VIEW [dbo].[our_quote_line_5_view]
AS
SELECT        dbo.our_quote_line_1_view.sol_no_k10, dbo.our_quote_line_1_view.niin_k08, dbo.our_quote_line_1_view.fsc_k08, dbo.our_quote_line_1_view.p_desc_k08, dbo.our_quote_line_1_view.upname_k34, 
                         dbo.our_quote_line_1_view.bidtyp_k34, dbo.our_quote_line_1_view.qrefno_k34, dbo.our_quote_line_1_view.mcage_k34, dbo.our_quote_line_1_view.pn_k34, dbo.our_quote_line_1_view.scage_k34, 
                         dbo.our_quote_line_1_view.trmdes_k34, dbo.our_quote_line_1_view.fobcod_k34, dbo.our_quote_line_1_view.valday_k34, dbo.our_quote_line_1_view.qty_ui_k34, dbo.our_quote_line_1_view.qty_k35, 
                         dbo.our_quote_line_1_view.up_k35, dbo.our_quote_line_1_view.daro_k35, dbo.our_quote_line_1_view.uptime_k34, dbo.our_quote_line_1_view.idnk08_k08, dbo.our_quote_line_1_view.idnk11_k11, 
                         dbo.our_quote_line_1_view.idnk34_k34, dbo.our_quote_line_1_view.idnk35_k35, dbo.our_quote_line_1_view.pn_rev_k34, dbo.our_quote_line_1_view.insmat_k34, dbo.our_quote_line_1_view.szip_k34, 
                         dbo.our_quote_line_1_view.qtek14_k34, dbo.our_quote_line_1_view.idnk10_k10, dbo.our_quote_line_1_view.idnkc4_kc4, dbo.our_quote_line_1_view.t_stat_k33, dbo.our_quote_line_1_view.idnk33_k33, 
                         dbo.our_quote_line_1_view.idnk31_k10, dbo.our_quote_line_1_view.source_k09, dbo.k63_tab.idnk63_k63, dbo.k63_tab.idnk62_k63, dbo.k63_tab.idnk34_k63, dbo.k63_tab.c_code_k63, dbo.k63_tab.c_text_k63, 
                         dbo.k63_tab.c_note_k63, dbo.k61_tab.fyiref_k61, dbo.k62_tab.seq_no_k62, dbo.k62_tab.fyttrt_k62, dbo.k63_tab.efftme_k63, dbo.our_quote_line_1_view.t_stme_k33, dbo.our_quote_line_1_view.c_code_k31
FROM            dbo.our_quote_line_1_view LEFT OUTER JOIN
                         dbo.k63_tab ON dbo.k63_tab.idnk63_k63 IN
                             (SELECT        TOP (1) idnk63_k63
                               FROM            dbo.k63_tab
                               WHERE        (idnk34_k63 = dbo.our_quote_line_1_view.idnk34_k34)
                               ORDER BY idnk63_k63 DESC) LEFT OUTER JOIN
                         dbo.k62_tab ON dbo.k63_tab.idnk62_k63 = dbo.k62_tab.idnk62_k62 LEFT OUTER JOIN
                         dbo.k61_tab ON dbo.k62_tab.idnk61_k62 = dbo.k61_tab.idnk61_k61







